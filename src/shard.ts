import { ShardingManager } from "discord.js";

const manager = new ShardingManager("./src/client.ts", {
	respawn: true,
	token: process.env["DISCORD_TOKEN"],
	totalShards: "auto",
	shardList: "auto",
});

manager
	.spawn({ amount: manager.totalShards, delay: undefined, timeout: -1 })
	.then((shards) => {
		console.info(`${shards.size} shard(s) spawned.`);
	})
	.catch(console.error);

manager.on("shardCreate", (shard) => {
	shard.on("ready", () => {
		console.info(`Shard ${shard.id} connected to Discord's Gateway.`);
	});
});
