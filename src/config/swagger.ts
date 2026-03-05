import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Edlight Initiative — Backend API',
      version: '1.0.0',
      description:
        'RESTful API documentation for the Edlight Initiative backend system. Manages user authentication, credential storage, and platform services.',
      contact: {
        name: 'Edlight Initiative',
        url: 'https://github.com/Fredler21/Backend_System',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API base path',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [path.join(__dirname, '..', 'modules', '**', '*.routes.ts')],
};

export const swaggerSpec = swaggerJsdoc(options);
