import { Poe } from "@lazuee/poe.js";

const tokens = process.env["POE_TOKENS"]?.split("|")?.filter((x) => typeof x === "string" && x.length > 5) ?? [];

export const poes = new Map<string, Poe>();

export const initialize = async () => {
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		const poe = new Poe({
			token: token,
			displayName: "Sage",
		});

		console.clear();
		console.info(`Initializing Poe${".".repeat(i + 1)}`);
		try {
			await poe.initialize();
			poes.set(token, poe);
		} catch (_) {}
	}
};

export const send_message: Poe["send_message"] = async (...args) => {
	return new Promise((resolve, reject) => {
		for (const poe of [...poes.values()]) {
			if (!poe.pendingCount) {
				poe.send_message(...args)
					.then(resolve)
					.catch(reject);
				return;
			}
		}

		for (const poe of [...poes.values()].sort((a, b) => a.pendingCount - b.pendingCount)) {
			poe.send_message(...args)
				.then(resolve)
				.catch(reject);
			return;
		}

		reject(new Error("No poe has been settled"));
	});
};
