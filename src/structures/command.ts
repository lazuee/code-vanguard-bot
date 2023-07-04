import {
	APIApplicationCommandOption,
	AnySelectMenuInteraction,
	ApplicationCommandDataResolvable,
	ApplicationCommandType,
	Awaitable,
	ButtonInteraction,
	ChatInputCommandInteraction,
	Client,
	ClientEvents,
	Collection,
	InteractionType,
	Message,
	MessageContextMenuCommandInteraction,
	ModalSubmitInteraction,
	PermissionResolvable,
	UserContextMenuCommandInteraction,
} from "discord.js";

import type {} from "@discordjs/builders";

import { addListener, setActive } from "../utils";
import Event, { EventOptions } from "./event";
import commands from "./store/command";

declare module "discord.js" {
	export interface Message {
		args: string[];
		commandName: string;
		isClientMention: boolean;
	}
}

interface CommandPermissions {
	client: PermissionResolvable[];
	user: PermissionResolvable[];
}

export default class Command<N extends string = string, D extends string = string> {
	public name: N;
	public description: D;
	public executor: {
		button?: (this: Command<N, D>, interaction: ButtonInteraction) => Awaitable<void>;
		contextMenu?: (
			this: Command<N, D>,
			interaction: MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction
		) => Awaitable<void>;
		selectMenu?: (this: Command<N, D>, interaction: AnySelectMenuInteraction) => Awaitable<void>;
		modalSubmit?: (this: Command<N, D>, interaction: ModalSubmitInteraction) => Awaitable<void>;
		interaction?: (this: Command<N, D>, interaction: ChatInputCommandInteraction) => Awaitable<void>;
		message?: (this: Command<N, D>, message: Message) => Awaitable<void>;
	};

	private __options?: APIApplicationCommandOption[];
	//@ts-ignore
	private __permissions: CommandPermissions = {
		client: [
			"AddReactions",
			"EmbedLinks",
			"ReadMessageHistory",
			"SendMessages",
			"SendMessagesInThreads",
			"UseExternalEmojis",
			"ViewChannel",
		],
		user: [],
	};
	private __events = new Collection<keyof ClientEvents, Event<keyof ClientEvents>[]>();
	private __options_called = false;
	private __permissions_called = false;
	private __connect_called = false;
	private __bypass = false;
	private __AnyCommandTriggered = "";

	constructor(name: N, description: D) {
		this.name = name as any;
		this.description = description as any;

		this.executor = {
			button: undefined,
			contextMenu: undefined,
			selectMenu: undefined,
			modalSubmit: undefined,
			interaction: undefined,
			message: undefined,
		};
		commands.set(this.name, this as any);
	}

	bypass() {
		this.__bypass = true;

		return this;
	}

	setExecutor(executor: Command<N, D>["executor"]) {
		if (typeof executor.button === "function") this.executor.button = executor.button;
		if (typeof executor.contextMenu === "function") this.executor.contextMenu = executor.contextMenu;
		if (typeof executor.selectMenu === "function") this.executor.selectMenu = executor.selectMenu;
		if (typeof executor.modalSubmit === "function") this.executor.modalSubmit = executor.modalSubmit;
		if (typeof executor.interaction === "function") this.executor.interaction = executor.interaction;
		if (typeof executor.message === "function") this.executor.message = executor.message;

		return this;
	}

	setOptions(options: APIApplicationCommandOption[]) {
		if (!this.__options_called) {
			this.__options = options;
			this.__options_called = true;
		} else process.emitWarning(`Command<${this.name}>#setOptions can only called once!`);

		return this;
	}

	setPermissions(permissions: CommandPermissions) {
		if (!this.__permissions_called) {
			this.__permissions = permissions;
			this.__permissions_called = true;
		} else process.emitWarning(`Command<${this.name}>#setPermissions can only called once!`);

		return this;
	}

	get data() {
		const slash: ApplicationCommandDataResolvable = {
			name: this.name,
			description: this.description,
			type: ApplicationCommandType.ChatInput,
			...(this.__options ? { options: this.__options } : {}),
		};
		slash.options;
		return {
			name: this.name,
			description: this.description,
			slash,
			events: [...this.__events.values()],
		};
	}

	useEvent<K extends keyof ClientEvents>(event: EventOptions<K>) {
		const events = this.__events.get(event.name) || [];
		this.__events.set(event.name, [...events, new Event(event as any)]);

		return this;
	}

	isTriggered(find: (commandName: string) => boolean) {
		const triggeredCommandName = [...commands.keys()].find(find);
		return triggeredCommandName === this.name;
	}

	connect(client: Client) {
		if (!this.__connect_called) {
			this.__connect_called = true;
		} else process.emitWarning(`Command<${this.name}>#connect can only called once!`);

		addListener(client, "messageCreate", async (message) => {
			if (!this.isTriggered((name) => name === message.commandName)) return;

			await this.executor.message?.call(this, message);
		});

		addListener(client, "interactionCreate", async (interaction) => {
			if (!interaction.inCachedGuild()) return;

			switch (interaction.type) {
				// Command
				case InteractionType.ApplicationCommand:
					// Chat Input Command
					if (interaction.isChatInputCommand()) {
						if (!this.isTriggered((name) => interaction.commandName?.startsWith(name))) return;

						await this.executor.interaction?.call(this, interaction);
					}
					// Command Menu
					else if (interaction.isContextMenuCommand()) {
						if (!this.isTriggered((name) => interaction.commandName?.startsWith(name))) return;

						await this.executor.contextMenu?.call(this, interaction);
					}
					break;

				// Component
				case InteractionType.MessageComponent:
					// Button
					if (interaction.isButton()) {
						if (!this.isTriggered((name) => interaction.customId?.startsWith(name))) return;

						await this.executor.button?.call(this, interaction);
					}
					// Select Menu
					else if (interaction.isAnySelectMenu()) {
						if (!this.isTriggered((name) => interaction.customId?.startsWith(name))) return;

						await this.executor.selectMenu?.call(this, interaction);
					}
					break;

				// Modal
				case InteractionType.ModalSubmit:
					if (!interaction.isModalSubmit()) return;
					if (!this.isTriggered((name) => interaction.customId?.startsWith(name))) return;

					await this.executor.modalSubmit?.call(this, interaction);
					break;

				default:
					break;
			}

			// commands/presence.ts
			setActive(client);
		});

		for (const events of [...this.__events.values()]) {
			for (const event of events) addListener(client, event.data.name, event.data.execute, event.data.once);
		}
	}
}
