// src/utils/responseUtil.js

export const sendSuccess = (res, message, data = {}, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        ...data,
    });
};

export const sendError = (res, error, statusCode = 500) => {
    const message =
        typeof error === 'string'
            ? error
            : error?.message || 'Something went wrong';

    return res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error : undefined,
    });
};
