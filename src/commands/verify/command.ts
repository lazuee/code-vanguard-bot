import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	Collection,
	EmbedBuilder,
	ModalActionRowComponentBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";

//@ts-ignore
import { CaptchaGenerator } from "captcha-canvas";
import * as crypto from "node:crypto";

import Command from "../../structures/command";

const VERIFIED_ROLE_ID = "972858428798173214";
const check = new Collection<string, { interaction: ButtonInteraction; text: string }>();

export default new Command("verify", "prove that your not a robot").setExecutor({
	message: async function (message) {
		if (message.args![0] !== "SETUP") return;

		const embed = new EmbedBuilder()
			.setTitle("Verification Required")
			.setDescription(`To access **${message.guild?.name}**, you need to pass the verification first!`)
			.setColor("#2f3136");
		const button = new ButtonBuilder()
			.setCustomId("verify-captcha")
			.setLabel("Verify")
			.setStyle(ButtonStyle.Success);
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

		await message.channel!.send({ content: "", embeds: [embed], components: [row] });
	},
	button: async function (interaction) {
		switch (interaction.customId.split("-").at(-1)) {
			case "captcha":
				{
					const { captcha, text } = await createCaptcha();
					check.set(interaction.user.id, { interaction, text });

					const embed = new EmbedBuilder()
						.setTitle("Are you human?")
						.setDescription("please enter the captcha code to get access!")
						.setColor("#2f3136")
						.setImage(`attachment://${text}.png`)
						.setFooter({ text: "Verification Period: 2 minutes" });
					const attachment = new AttachmentBuilder(captcha, { name: `${text}.png` });
					const button = new ButtonBuilder()
						.setCustomId("verify-answer")
						.setLabel("Answer")
						.setStyle(ButtonStyle.Primary);
					const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
					await interaction.deferReply({
						ephemeral: true,
					});
					await interaction.followUp({
						content: "",
						embeds: [embed],
						components: [row],
						files: [attachment],
					});

					const deleteCheck = async () => {
						if (check.has(interaction.user.id)) {
							const embed = new EmbedBuilder()
								.setAuthor({
									name: "Unsuccessful Operation",
									iconURL:
										"https://cdn.discordapp.com/emojis/660789591900684329.webp?size=96&quality=lossless",
								})
								.setDescription("You reached the verification timeout!")
								.setColor("#2f3136");

							await check.get(interaction.user.id)?.interaction.editReply({
								content: "",
								embeds: [embed],
								components: [],
								files: [],
							});

							check.delete(interaction.user.id);
						}
					};
					setTimeout(deleteCheck, 125000);
				}
				break;
			case "answer":
				{
					const modal = new ModalBuilder().setCustomId("verify").setTitle("Verification");
					const modalDescription = new TextInputBuilder()
						.setCustomId("text")
						.setLabel("Captcha Code")
						.setRequired(true)
						.setPlaceholder("Enter Code")
						.setStyle(TextInputStyle.Short);
					const actionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
						modalDescription
					);
					modal.addComponents(actionRow);

					await interaction.showModal(modal);
				}
				break;
			default:
				break;
		}
	},
	modalSubmit: async function (interaction) {
		if (!check.has(interaction.user.id)) return;

		const text = interaction.fields.getTextInputValue("text");
		if (check.get(interaction.user.id)!.text.toLowerCase() !== text.toLowerCase()) {
			const embed = new EmbedBuilder()
				.setAuthor({
					name: "Unsuccessful Operation",
					iconURL: "https://cdn.discordapp.com/emojis/660789591900684329.webp?size=96&quality=lossless",
				})
				.setDescription("The captcha code you've entered is incorrect!")
				.setColor("#2f3136");

			await check.get(interaction.user.id)?.interaction.editReply({
				content: "",
				embeds: [embed],
				components: [],
				files: [],
			});

			await interaction.reply({ content: "Try again!", ephemeral: true }).catch(() => {});
			check.delete(interaction.user.id);
		} else {
			const embed = new EmbedBuilder()
				.setAuthor({
					name: "You have been verified!",
					iconURL: "https://cdn.discordapp.com/emojis/660789936651370497.webp?size=96&quality=lossless",
				})
				.setDescription(
					`You passed the verification successfully! You can now access to \`${interaction.guild?.name}\`!`
				)
				.setColor("#64cc5b");

			await check.get(interaction.user.id)?.interaction.editReply({
				content: "",
				embeds: [embed],
				components: [],
				files: [],
			});
			check.delete(interaction.user.id);

			const member = interaction.guild!.members.cache.get(interaction.user.id);
			await member?.roles.add(VERIFIED_ROLE_ID);
			await interaction.reply({ content: "Enjoy chatting!", ephemeral: true });
		}
	},
});

async function createCaptcha() {
	let text = crypto.randomBytes(32).toString("hex");
	text = text.substring(0, 6);

	const generator = new CaptchaGenerator().setDecoy({ opacity: 0.6, total: 15 });
	generator.setCaptcha({ text });
	return { captcha: await generator.generate(), text };
}
