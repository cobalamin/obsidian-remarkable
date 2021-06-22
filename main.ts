import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, MarkdownView } from 'obsidian';
import moment from 'moment';
import { spawn } from 'child_process';
import path from 'path';

interface MyPluginSettings {
    reSnapPath: string;
    invertRemarkableImages: boolean;
    outputPath: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    reSnapPath: '',
    invertRemarkableImages: true,
    outputPath: '.'
}

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;
    cm: CodeMirror.Editor;

    async onload() {
	//console.log('loading reMarkable Obsidian');
	await this.loadSettings();

	this.addRibbonIcon('dice', 'reMarkable Obsidian', () => {
	    new Notice('This is a notice!');
	});

	this.app.moment = moment;

	//this.addStatusBarItem().setText('Status Bar Text');

	this.addCommand({
	    id: 'insert-remarkable-drawing',
	    name: 'Insert a drawing from the reMarkable',
	    checkCallback: (checking: boolean) => {
		let leaf = this.app.workspace.activeLeaf;
		let view = leaf.view;
		if (leaf) {
		    const result = true;//view instanceof MarkdownSourceView; is not working... always false.
		    if (result && !checking) {
			this.tryInsertingDrawing();
		    }
		    return result;
		}
		return false;
	    }
	});

	this.addSettingTab(new SampleSettingTab(this.app, this));

	this.registerCodeMirror((cm: CodeMirror.Editor) => {
	    this.cm = cm;
	});

	this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
	    //console.log('click', evt);
	});
    }

    onunload() {
	//console.log('unloading reMarkable Obsidian');
    }

    async loadSettings() {
	this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
	await this.saveData(this.settings);
    }

    async callReSnap() {
	const { reSnapPath } = this.settings;
	const { spawn } = require('child_process');
	const executable = reSnapPath;

	const now = moment();
	const drawingFileName = `rM drawing ${now.format("YYYY-MM-DD-HH.mm.ss")}.png`;
	const vaultAbsPath = this.app.vault.adapter.basePath;
	const attachmentFolder = this.app.vault.getConfig('attachmentFolderPath');
	const drawingFilePath = path.join(vaultAbsPath, attachmentFolder, drawingFileName);

	return new Promise(function (resolve, reject) {
	    const args = ['-o', drawingFilePath];
	    const process = spawn(executable, args);

	    let stdout = "";
	    let stderr = "";
	    process.stdout.on('data', (data) => { stdout += data; });
	    process.stderr.on('data', (data) => { stderr += data; });

	    process.on('close', async function (code: Number) {
		if(code === 0) {
		    resolve(drawingFileName);
		}
		else {
		    reject("Nonzero exitcode. STDERR: " + stderr + "\n STDOUT: " + stdout);
		}
	    });
	    process.on('error', function (err: String) {
		reject(err);
	    });
	});
    }

    async tryInsertingDrawing() {
	let success = false;
	try {
	    const drawingFileName = await this.callReSnap();
	    this.editor.replaceRange(`![[${drawingFileName}]]`, this.editor.getCursor());

	    new Notice('Inserted the rM drawing!');
	    return true;
	} catch(error) {
	    console.error('[reMarkable-Obsidian:reSnap]', error);
	    new Notice('Failed to insert rM drawing! Errors printed to console.');
	    return false;
	}
    }

    /* shamelessly stolen from hans/obsidian-citation-plugin */
    get editor(): CodeMirror.Editor {
	const view = this.app.workspace.activeLeaf.view;
	if (!(view instanceof MarkdownView)) return null;

	const sourceView = view.sourceMode;
	return (sourceView as MarkdownSourceView).cmEditor;
    }
}

class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
	super(app, plugin);
	this.plugin = plugin;
    }

    display(): void {
	let {containerEl} = this;

	containerEl.empty();
	containerEl.createEl('h2', {text: 'Settings for reMarkable Obsidian'});

	new Setting(containerEl)
	    .setName('reSnap executable')
	    .setDesc('The path to the reSnap executable')
	    .addText(text => text
	    .setPlaceholder('Please paste in an absolute path')
	    .setValue(this.plugin.settings.reSnapPath)
	    .onChange(async (value) => {
		this.plugin.settings.reSnapPath = value;
		await this.plugin.saveSettings();
	    }));

	new Setting(containerEl)
	    .setName('Output folder')
	    .setDesc('The folder where rM drawing images should be stored')
	    .addText(text => text
	    .setPlaceholder('Type in a folder from your Vault')
	    .setValue(this.plugin.settings.outputPath)
	    .onChange(async (value) => {
		this.plugin.settings.outputPath = value;
		await this.plugin.saveSettings();
	    }));
    }
}
