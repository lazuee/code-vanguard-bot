import { Awaitable, Client, ClientEvents } from "discord.js";

export interface EventOptions<K extends keyof ClientEvents> {
	name: K;
	execute: (this: Client, ...args: ClientEvents[K]) => Awaitable<void>;
	once: boolean;
}

export default class Event<K extends keyof ClientEvents> {
	private __data: EventOptions<K>;

	constructor(options: EventOptions<K>) {
		this.__data = options;

		this.__validate();
	}

	get data() {
		return this.__data;
	}

	private __validate(): void {
		if (typeof this.__data?.name !== "string") throw new TypeError("Event name must be a string.");
		if (typeof this.__data?.once !== "boolean") throw new TypeError("Event once must be a boolean.");
		if (typeof this.__data?.execute !== "function") throw new TypeError("Event execute must be a function.");
	}
}
