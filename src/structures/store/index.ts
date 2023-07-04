import { Collection } from "discord.js";

export class Store<K, V> extends Collection<K, V> {
	constructor() {
		super();
	}
}

const store = new Store<string, any>();

export default store;
