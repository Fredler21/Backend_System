import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types';

/**
 * Send a standardized success response.
 */
export function sendSuccess<T>(res: Response, message: string, data?: T, statusCode = 200): void {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  res.status(statusCode).json(response);
}

/**
 * Send a standardized error response.
 */
export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: Record<string, string[]>,
): void {
  const response: ApiResponse = {
    success: false,
    message,
    errors,
  };
  res.status(statusCode).json(response);
}

/**
 * Send a paginated success response.
 */
export function sendPaginated<T>(
  res: Response,
  message: string,
  data: T[],
  total: number,
  page: number,
  limit: number,
): void {
  const response: PaginatedResponse<T> = {
    success: true,
    message,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
  res.status(200).json(response);
}
