import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message } from "discord.js";

import { Conversation } from "@lazuee/poe.js";
import { SetIntervalAsyncTimer, clearIntervalAsync, setIntervalAsync } from "set-interval-async";

import Command from "../../structures/command";
import commands from "../../structures/store/command";
import { setActive } from "../../utils";
import { poes, send_message } from "./poe";

const messagesClient: Record<
	string,
	{ history: Conversation[]; message_ids: string[]; intervalId?: SetIntervalAsyncTimer<[]> }
> = {};

const loading = "<a:loading:1118947021508853904>";
const maxLength = 1800 + loading.length;

export default new Command("gpt", "Ask me anything")
	.setExecutor({
		message: async function (message) {
			if (message.args![0] !== "SETUP") return;
			const embed = new EmbedBuilder()
				.setDescription("Click the button below to start asking questions.")
				.setColor("#2f3136");
			const button = new ButtonBuilder()
				.setCustomId("gpt-thread")
				.setLabel("Start")
				.setStyle(ButtonStyle.Success);
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

			await message.channel.send({ content: "", embeds: [embed], components: [row] });
		},
	})
	.useEvent({
		name: "messageReactionAdd",
		once: false,
		execute: async function (reaction, user) {
			if (user.bot) return;
			if (reaction.message.partial) await reaction.message.fetch();
			if (
				reaction.message.reactions.cache.find(
					(r) => r.emoji.name === reaction.emoji.name && !r.users.cache.has(reaction.client.user.id)
				)
			)
				return;

			const data = Object.values(messagesClient).find(({ message_ids }) =>
				message_ids.includes(reaction.message.id)
			);
			const key = Object.entries(messagesClient).find(([_, value]) => value === data)?.[0] ?? "";
			if (!data) return;

			switch (reaction.emoji.toString()) {
				case "🔁": {
					const intervalId = data?.intervalId;
					if (intervalId) {
						await clearIntervalAsync(intervalId);
						delete messagesClient[key].intervalId;
					}

					const message = await reaction.message.channel.messages.cache
						.get(data.message_ids[0]!)!
						.fetchReference();

					for (const message_id of data.message_ids)
						await reaction.message.channel.messages.cache.get(message_id)?.delete();

					chat(message, data.history, key);
					return;
				}
				case "❌": {
					const intervalId = data?.intervalId;
					if (intervalId) {
						await clearIntervalAsync(intervalId);
						delete messagesClient[key].intervalId;

						const message = reaction.message.channel.messages.cache.get(data.message_ids.at(-1)!);
						await message?.edit(message.content.replace(loading, "").replace(/[ \t\r\n]+$/g, ""));
						await message?.reactions.cache.get("❌")?.remove();
					}
					return;
				}
				default:
					break;
			}
		},
	})
	.useEvent({
		name: "messageCreate",
		once: false,
		execute: async function (message) {
			if (!message.channel.isThread()) return;
			if (message.system || message.author.bot) return;
			if (message.isClientMention) message.content = `${message.commandName} ${message.args.join(" ")}`;
			if ([...commands.values()].some((command) => command.isTriggered((name) => name === message.commandName)))
				return;
			if ([...poes.values()].length <= 0) {
				message.reply("Sorry, it appears that I have run out of tokens.");
				return;
			}

			const key = String.fromCharCode(Math.floor(Math.random() * 26) + 97) + Date.now().toString();
			const history = await getHistory(message);
			messagesClient[key] = {
				history,
				message_ids: [],
			};

			chat(message, history, key);
		},
	});

async function getHistory(message: Message, conversation: Conversation[] = []): Promise<Conversation[]> {
	if (conversation.length <= 25) {
		const regex = new RegExp(`^(@${message.client.user.username})`, "g");
		let content = message.cleanContent.replace(regex, "").trim();

		if (content.length <= 0 && message.embeds?.[0] && message.author.id === message.client.user.id)
			content = message.embeds[0].description ?? "";

		if (content.length <= 0) content = "^ see last message in conversation history.";
		conversation.push({
			role: message.author.bot ? "model" : "user",
			content,
			name: message.author.username,
		});

		const reply = await message.fetchReference().catch(() => null);
		if (reply) return await getHistory(reply, conversation);
	}

	return conversation.reverse();
}

async function chat(message: Message, history: Conversation[], key: string) {
	const conversation: Conversation[] = [
		{
			role: "system",
			content: `
You are ${message.client.user.username}. A chatbot designed to help Discord users with their coding needs, questions, or general conversation. You cannot add comments to code - never adding any comments.

You'll respond concisely while maintaining proper language etiquette. If a user asks who you are or what you do, you may tell them. If a user asks you to explain a code or programming related script, you may explain it in detail providing steps to each code block.

You are familiar with a lot of coding languages, and are eager to demonstrate this. When asked for code, use triple backticks with the appropriate suffix, e.g. 'md', 'ts' 'csharp' and so on.
`,
		},
	];

	const formatContent = (content: string) =>
		content.replace(/([\n\r]{2,})(?=[^\n\r]*```[\s\S]*?```)|([\n\r]{2,})(?=[^\n\r])/g, "\n");
	const editMessage = async (content: string, isLoading = true) => {
		content = formatContent(content);
		content += isLoading ? loading : "";
		await message.channel.messages.cache.get(messagesClient[key].message_ids.at(-1)!)?.edit(content);
	};
	const sendMessage = async (content: string, isLoading = true) => {
		content = formatContent(content);
		content += isLoading ? loading : "";
		const _message = await message.channel.send(content);
		messagesClient[key].message_ids.push(_message.id);
	};

	const _message = await message.reply(loading + "ㅤ");
	await _message?.react("🔁");
	await _message?.react("❌");

	messagesClient[key].message_ids = [];
	messagesClient[key].message_ids.push(_message.id);

	let nextText: string | null = null;
	let currentText = "";
	messagesClient[key].intervalId = setIntervalAsync(async () => {
		if (nextText === null) return;
		if (nextText?.length) {
			if (currentText.endsWith(nextText)) return;
			currentText += nextText;
			nextText = "";

			let content = currentText.replace(/[ \t\r\n]+$/g, "");
			const lastCodeblock = content.match(/`{3}(?:[\S]+)?\n([\s\S]+)(?:\n`{3}|$)/g)?.pop() ?? null;
			const noClosingCodeblock = lastCodeblock?.match(/`{3}/g)?.length === 1;
			const lastLine =
				content
					?.split("\n")
					?.filter((x) => x.length)
					?.pop() ?? "";

			if (noClosingCodeblock) content = content + "\n```";
			else content = content + " ";

			if (content.length >= maxLength) {
				await message.channel.messages.cache
					.get(messagesClient[key].message_ids.at(-1)!)
					?.reactions?.removeAll();
				if (noClosingCodeblock) {
					const prevContent = content.substring(0, content.indexOf(lastCodeblock));
					await editMessage(prevContent, false);
					const nextContent = content.substring(content.indexOf(lastCodeblock));
					currentText = currentText.substring(currentText.indexOf(lastCodeblock));
					await sendMessage(nextContent);
				} else {
					const prevContent = content.substring(0, content.indexOf(lastLine));
					await editMessage(prevContent, false);
					const nextContent = content.substring(content.indexOf(lastLine));
					currentText = currentText.substring(currentText.indexOf(lastLine));
					await sendMessage(nextContent);
				}

				const _message = message.channel.messages.cache.get(messagesClient[key].message_ids.at(-1)!);
				await _message?.react("🔁");
				await _message?.react("❌");
			} else await editMessage(content);
		} else {
			await clearIntervalAsync(messagesClient[key].intervalId!);
			delete messagesClient[key].intervalId;

			await editMessage(currentText, false);
			const _message = message.channel.messages.cache.get(messagesClient[key].message_ids.at(-1)!);
			await _message?.reactions.cache.get("❌")?.remove();

			const _message_id = messagesClient[key].message_ids.at(-1);
			setTimeout(() => {
				const __message_id = messagesClient[key].message_ids.at(-1)!;
				if (_message_id !== __message_id) return;

				message.channel.messages.cache.get(__message_id)?.reactions?.removeAll();
				delete messagesClient[key];
			}, 3 * 60 * 1000);
		}
	}, 1000);

	await send_message(conversation.concat(history), {
		withChatBreak: true,
		onRunning: () => {
			setActive(message.client);
		},
		onTyping: async (msg) => {
			if (typeof nextText !== "string") nextText = "";
			nextText += msg.text_new;

			await new Promise((resolve) => setTimeout(resolve, 200));
		},
	});
}
