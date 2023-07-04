import store from ".";
import Command from "../command";

const setToStore = (collection: CommandStore) => store.set("commands", collection as any);

class CommandStore extends Map<string, Command<any, any>> {
	constructor() {
		super();
		setToStore(this);
	}

	set(key: string, value: Command) {
		super.set(key, value);
		setToStore(this);

		return this;
	}

	delete(key: string) {
		const result = super.delete(key);
		setToStore(this);

		return result;
	}
}

export default new CommandStore();
