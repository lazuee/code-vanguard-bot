import { Awaitable, Client, ClientEvents, Interaction, InteractionType, Message } from "discord.js";

import store from "../structures/store";

type Func = () => Promise<void>;
type ErrorHandler = (error: Error, attempt: number) => Promise<boolean>;
type ExhaustedHandler = (error: Error) => Promise<void>;

export const withRetry = async (
	func: Func,
	errorHandler: ErrorHandler,
	exhaustedHandler: ExhaustedHandler,
	maxAttempts: number = 5,
	retryDelay: number = 5000
): Promise<void> => {
	let attempt = 0;
	while (attempt < maxAttempts) {
		attempt += 1;
		try {
			await func();
			break;
		} catch (error: any) {
			const shouldRetry = await errorHandler(error, attempt);
			if (!shouldRetry) {
				await exhaustedHandler(error);
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, retryDelay));
		}
	}
};

export const setActive = (client: Client, active = true) => {
	if (client.user?.presence.status != "online" && active) {
		store.set("lastActive", Date.now());
		client.user?.setPresence({ status: "online" });
	} else if (client.user?.presence.status != "idle") client.user?.setPresence({ status: "idle" });
};

export const addListener = function <K extends keyof ClientEvents>(
	client: Client,
	event: K,
	listener: (...args: ClientEvents[K]) => Awaitable<any>,
	once = false
) {
	if (client)
		client[once ? "once" : "on"](event, async (...args) => {
			if (args[0] instanceof Message) {
				const regex = new RegExp(`<[@]?${args[0].client.user?.id}+>`);

				args[0].isClientMention = false;
				if (args[0].mentions.repliedUser?.id === args[0].client.user?.id) {
					args[0].args = args[0].content.trim().split(/ +/g) as string[];
					args[0].commandName = args[0].args.shift()?.toLowerCase() ?? "";
					args[0].isClientMention = true;
				} else if (regex.test(args[0].content)) {
					const _args = args[0].content.replace(regex, "").trim().split(/ +/g) as string[];
					args[0].commandName = _args.shift()?.toLowerCase() ?? "";
					args[0].args = _args;
					args[0].isClientMention = true;
				}
			}

			try {
				await listener?.call(client, ...args);
			} catch (error) {
				console.error(`An error occurred while calling the listener`, { error });

				const arg = args[0];
				if (arg instanceof Message) {
					arg.reply({
						content: "An error occurred! Please try again later.",
					});
				} else {
					if (typeof arg === "object" && "inCachedGuild" in arg! && !arg?.inCachedGuild()) return;
					const interaction = arg as Interaction;
					//@ts-ignore
					switch (interaction?.type) {
						// Command
						case InteractionType.ApplicationCommand:
						case InteractionType.MessageComponent:
						case InteractionType.ModalSubmit:
							{
								if (!interaction.replied) {
									if (interaction.deferred) {
										interaction.editReply({
											content: "An error occurred! Please try again later.",
										});
									} else {
										interaction.reply({
											ephemeral: true,
											content: "An error occurred! Please try again later.",
										});
									}
								}
							}
							break;
						default:
							break;
					}
				}
			}
		});
};
