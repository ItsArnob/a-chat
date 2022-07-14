export function validate(config: Record<string, any>) {
    const requiredProperties = ['JWT_SECRET'];
    const errors: string[] = [];
    requiredProperties.forEach((property: string) => {
        if (!config[property] || !config[property].trim()) {
            errors.push(property);
        }
    });

    if (config.NODE_ENV !== 'production') {
        config.CORS_ALLOWED_DOMAINS
            ? (config.CORS_ALLOWED_DOMAINS +=
                  ' http://localhost:3000 https://hoppscotch.io')
            : (config.CORS_ALLOWED_DOMAINS =
                  'http://localhost:3000 https://hoppscotch.io http://192.168.0.107:3000');
    }

    if (errors.length) {
        throw new Error(
            `Error: Missing the following REQUIRED environment variables: ${errors.join(
                ' | '
            )}`
        );
    }
    return config;
}
export const config = () => {
    return {
        jwt: {
            secret: process.env.JWT_SECRET,
            expiresIn: Number(process.env.JWT_EXPIRATION_TIME),
        },
        db: {
            name: process.env.DB_NAME || "a_chat",
            uri: process.env.DB_URI || "mongodb://localhost:27017"
        },
        logLevel: process.env.LOG_LEVEL || 'info',
        port: process.env.PORT ? parseInt(process.env.PORT) : 5000,
        discordWebhookURL: process.env.DISCORD_WEBHOOK_URL,
        secureCookie: !!process.env.SECURE_COOKIE,
        trustProxy: !!process.env.TRUST_PROXY,
        corsOrigins: process.env.CORS_ALLOWED_DOMAINS?.split(' ') || [],
        bcryptRounds: process.env.BCRYPT_ROUNDS
            ? parseInt(process.env.BCRYPT_ROUNDS)
            : 10,
        disableSignup: !!process.env.DISABLE_SIGNUP
    };
};
