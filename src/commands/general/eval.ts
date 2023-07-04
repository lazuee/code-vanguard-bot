import { AttachmentBuilder } from "discord.js";

import axios from "axios";
import { Agent as httpAgent } from "http";
import { Agent as httpsAgent } from "https";

import Command from "../../structures/command";

const languages = new Map<string, Record<string, any>>();
const request = axios.create({
	baseURL: "https://emkc.org/api/v1/piston",
	timeout: 60000,
	httpAgent: new httpAgent({ keepAlive: true }),
	httpsAgent: new httpsAgent({ keepAlive: true }),
});

export default new Command("eval", "Evaluate your code")
	.setExecutor({
		message: async function (message) {
			if (!message.args.length || message.system || message.author.bot) return;
			const code = message.args.join(" ");
			const regex = /```([\S]+)?\n([\s\S]+)(?:\n|)```/;
			if (!regex.test(code)) {
				message.reply(
					"Please wrap the code in a code block using triple backticks (```).\nExample: ```js\nyour code here```"
				);
				return;
			}

			const [_, language, source] = code.match(regex) ?? [];
			const langData = [...languages.values()].find(
				({ aliases, name }) => aliases.some((alias: string) => alias === language) || name === language
			);
			console.log(language, langData);
			if (!langData) {
				message.reply(
					"Sorry, the code provided is not supported. Please use a valid programming language when using code blocks."
				);
				return;
			}

			const payload = { language, source, args: [] };
			const start = process.hrtime();

			let data: Record<string, any> = {};
			try {
				const response = await request.post("/execute", payload);
				data = response.data;
			} catch (error) {
				console.error(error);
			}

			const attachment = new AttachmentBuilder(Buffer.from(`${data.output.replaceAll("/piston/jobs", "")}`), {
				name: "output.xl",
			});
			const end = ((diff) => (diff[0] * 1e9 + diff[1]) * 1e-6)(process.hrtime(start));
			message.reply({
				content: `*It took \`${end}ms\` to evaluate the code.*`,
				files: [attachment],
			});
		},
		interaction: (interaction) => {
			console.log(interaction);
		},
	})
	.useEvent({
		name: "ready",
		once: false,
		execute: async () => {
			try {
				const response = await request.get("/versions");
				const data = response.data;
				for (const lang of data) languages.set(lang.name, lang);
			} catch (error) {
				console.error("Failed to fetch languages:", error);
			}
		},
	});
