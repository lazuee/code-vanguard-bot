const { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } = require("fs");
const { join, dirname, resolve, extname } = require("path");
const { outDir } = require("../tsconfig.json").compilerOptions;

const changeImportStatementsInFile = (filePath) => {
	if (extname(filePath) !== ".js") return;
	const fileContent = readFileSync(filePath, "utf8");
	const modifiedContent = fileContent.replace(
		/(from\s+['"])(\.{0,2}(?:\/[\w\s-./]+)*\/?)(['"])/g,
		(_, p1, p2, p3) => {
			if (p2.endsWith(".ts") || p2.endsWith(".js")) {
				return `${p1}${p2.replace(/\.[tj]s$/, ".js")}${p3}`;
			} else {
				const resolvedPath = resolve(dirname(filePath), p2);
				const extension =
					existsSync(resolvedPath) && lstatSync(resolvedPath).isDirectory() ? "/index.js" : ".js";
				p2 =
					existsSync(`${resolvedPath}${extension}`) && lstatSync(`${resolvedPath}${extension}`).isFile()
						? `${p2}${extension}`
						: p2;
				return `${p1}${p2}${p3}`;
			}
		}
	);
	writeFileSync(filePath, modifiedContent, "utf8");
};

const changeImportStatementsInDirectory = (dir) => {
	readdirSync(dir).forEach((file) => {
		const filePath = join(dir, file);
		if (lstatSync(filePath).isDirectory()) {
			changeImportStatementsInDirectory(filePath);
		} else {
			changeImportStatementsInFile(filePath);
		}
	});
};

changeImportStatementsInDirectory(outDir);
