import Event from "../../structures/event";

console.time("Time to online");
export default new Event({
	name: "ready",
	once: true,
	execute: async function (client) {
		console.info("Client is online!");
		console.timeEnd("Time to online");

		try {
			const commands = [...client.commands.values()]
				.filter((command) => typeof command.executor?.interaction === "function")
				.map((command) => command.data.slash);

			if (process.env["DEPLOY_INTERACTION"] === "true") {
				await client.application.commands.set([], process.env["DISCORD_GUILD_ID"]!);
				await client.application.commands.set(commands, process.env["DISCORD_GUILD_ID"]!);
			}
		} catch (error) {
			console.error("An error occurred while deploying interaction commands", { error });
		}

		const userCount = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
		const serverCount = client.guilds.cache.size;

		console.info(`Bot is running ${userCount} users and ${serverCount} servers`);
	},
});
