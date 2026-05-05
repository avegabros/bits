import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'BITS API Documentation',
            version: '2.0.0',
            description: 'Biometric Integrated Timekeeping System API — full endpoint reference for Auth, Attendance, Employees, Devices, Shifts, Reports, and more.',
            contact: {
                name: 'Avega Bros',
            },
        },
        servers: [
            {
                url: '/',
                description: 'Current environment (auto-detected)',
            },
        ],
        tags: [
            { name: 'Auth', description: 'Authentication & session management' },
            { name: 'Users', description: 'Admin/HR user account management' },
            { name: 'Employees', description: 'Employee CRUD & biometric enrollment' },
            { name: 'Attendance', description: 'Attendance records, sync, & corrections' },
            { name: 'Shifts', description: 'Shift schedule management' },
            { name: 'Companies', description: 'Company management' },
            { name: 'Branches', description: 'Branch management' },
            { name: 'Departments', description: 'Department management' },
            { name: 'Devices', description: 'ZKTeco biometric device management' },
            { name: 'Holidays', description: 'Holiday management (regular & special)' },
            { name: 'System', description: 'Sync scheduler configuration, manual triggers, and system health' },
            { name: 'Logs', description: 'System audit / activity logs' },
            { name: 'Me (Employee Self-Service)', description: 'Endpoints for logged-in users to access their own data' },
            { name: 'Time', description: 'Server time synchronization' },
            { name: 'Health', description: 'Application and device health checks' },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'accessToken',
                    description: 'HTTP-only cookie set after login',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string' },
                        error: { type: 'string' },
                    },
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: [
        './src/app.ts',
        './src/modules/**/*.routes.ts',
        './src/modules/**/*.controller.ts',
        './src/modules/**/*.types.ts'
    ],
};

export const swaggerSpec = swaggerJsdoc(options);
