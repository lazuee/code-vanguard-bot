import { Client as Bot, Collection, GatewayIntentBits, Partials } from "discord.js";

import { PrismaClient } from "@prisma/client";
import glob from "fast-glob";
import { resolve } from "path";
import { fileURLToPath } from "url";

import { addListener } from "../utils";
import Command from "./command";
import Event from "./event";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
declare module "discord.js" {
	export interface Client {
		commands: Collection<string, Command>;
		prisma: PrismaClient;
	}
}

export default class Client extends Bot {
	public commands = new Collection<string, Command>();
	public prisma = new PrismaClient();

	constructor() {
		super({
			intents: [
				GatewayIntentBits.MessageContent,
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildIntegrations,
				GatewayIntentBits.GuildEmojisAndStickers,
				GatewayIntentBits.DirectMessageReactions,
				GatewayIntentBits.DirectMessageTyping,
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.GuildMessageReactions,
				GatewayIntentBits.GuildMessageTyping,
				GatewayIntentBits.GuildMessages,
			],
			partials: [
				Partials.User,
				Partials.GuildMember,
				Partials.ThreadMember,
				Partials.Channel,
				Partials.Message,
				Partials.Reaction,
			],
			allowedMentions: { parse: ["roles"], repliedUser: false },
		});
	}

	async start() {
		await this.prisma
			.$connect()
			.then(() => {
				console.info(`Connected to the database`);
			})
			.catch((error) => {
				console.error("An error occurred while connecting to the database", { error });
			});

		await this.loadAll();
		await super.login(process.env["DISCORD_TOKEN"]);
	}

	async loadAll() {
		for (const filename of glob.sync("commands/**/*.{js,ts}", { cwd: resolve(__dirname, "..") })) {
			try {
				const filepath = resolve(__dirname, "..", filename);
				const command: Command = (await import(filepath)).default;
				if (!(command instanceof Command)) continue;

				command.connect(this);
				this.commands.set(command.name, command);
			} catch (error) {
				console.error("An error occurred while loading the commands", { error });
			}
		}

		for (const filename of glob.sync("events/**/*.{js,ts}", { cwd: resolve(__dirname, "..") })) {
			try {
				const filepath = resolve(__dirname, "..", filename);
				const data = (await import(filepath)).default;
				const events: Event<any>[] = Array.isArray(data) ? [...data] : [data];
				for (const event of events) {
					if (!(event instanceof Event)) continue;
					addListener(this, event.data.name, event.data.execute, event.data.name);
				}
			} catch (error) {
				console.error("An error occurred while loading the events", { error });
			}
		}
	}
}
