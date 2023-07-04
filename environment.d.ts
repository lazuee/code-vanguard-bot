declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV: "production" | "development";
			DISCORD_TOKEN: string;
			DISCORD_GUILD_ID: string;
			DEPLOY_INTERACTION: "true" | "false";
			POE_TOKENS: string;
		}
	}
}

export {};
