import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Sha256 } from "@aws-crypto/sha256-js";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

import { AWS_REGION, S3_VECTOR_BUCKET, AWS_S3_BUCKET_NAME, S3_VECTOR_INDEX } from "../lib/config.js";
import { embedQuery } from "./embeddingService.js";
// AWS S3 client for general file uploads
const s3 = new S3Client({
    region: AWS_REGION,
});

// Helper to sign AWS S3 Vectors REST API requests
export const signAndSendS3Vectors = async ({ method, path, body }) => {
    const region = AWS_REGION;
    const bucket = S3_VECTOR_BUCKET;

    const signer = new SignatureV4({
        credentials: defaultProvider(),
        service: "s3",
        region,
        sha256: Sha256,
    });

    const request = new HttpRequest({
        method,
        protocol: "https:",
        hostname: `${bucket}.s3.${region}.amazonaws.com`,
        path: `/${path}`,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });

    const signedRequest = await signer.sign(request);

    const res = await fetch(`https://${request.hostname}${request.path}`, {
        method,
        headers: signedRequest.headers,
        body: request.body,
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`S3 Vector API error: ${res.status} ${errText}`);
    }

    return res.json();
};

// Upload document to S3
export const uploadDocumentToS3 = async (file, assistantId) => {
    const fileExt = path.extname(file.name);
    const fileKey = `uploads/${assistantId}/${uuidv4()}${fileExt}`;

    const uploadParams = {
        Bucket: AWS_S3_BUCKET_NAME,
        Key: fileKey,
        Body: file.data,
        ContentType: file.mimetype,
    };

    await s3.send(new PutObjectCommand(uploadParams));

    return {
        key: fileKey,
        url: `https://${AWS_S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${fileKey}`,
    };
};

// Upsert chunks to S3 Vectors
export const upsertChunksToS3Vectors = async (chunksWithEmbeddings, assistantId) => {
    const vectors = chunksWithEmbeddings.map(({ text, embedding }, idx) => ({
        key: `chunk-${Date.now()}-${idx}`,
        data: { float32: embedding },
        metadata: {
            source_text: text,
            assistantId,
        },
    }));

    return await signAndSendS3Vectors({
        method: "POST",
        path: "PutVectors",
        body: {
            vectorBucketName: S3_VECTOR_BUCKET,
            indexName: S3_VECTOR_INDEX,
            vectors,
        },
    });
};

// Query documents in S3 Vectors
export const queryS3Vectors = async ({ query, assistantId }) => {
    const embedding = await embedQuery(query);
    const s3resp = await signAndSendS3Vectors({
        method: 'POST',
        path: 'QueryVectors',
        body: {
            vectorBucketName: S3_VECTOR_BUCKET,
            indexName: S3_VECTOR_INDEX,
            queryVector: { float32: embedding },
            topK: 5,
            filter: {
                assistantId: assistantId
            },
        },
    });
    const texts = s3resp.matches.map(m => m.metadata.source_text);
    // Return joined or JSON
    return { results: texts };
}
