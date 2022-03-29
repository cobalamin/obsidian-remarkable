const spawn = require('child_process').spawn;
const path = require('path');

//import * as moment from 'moment';
import { App, Modal, Notice, Plugin, PluginSettingTab, Editor,
         Setting, MarkdownView, MarkdownSourceView, FileSystemAdapter } from 'obsidian';

import * as obsidian from 'obsidian';

import moment from 'moment';

interface MyPluginSettings {
    reSnapPath: string;
    invertRemarkableImages: boolean;
    outputPath: string;
    rmAddress: string;
    postprocessor: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    reSnapPath: '',
    invertRemarkableImages: true,
    outputPath: '.',
    rmAddress: '10.11.99.1',
    postprocessor: ''
}

function mkCheckCallback(innerFn: () => any): (checking: boolean) => boolean {
    return function checkCallback(checking: boolean): boolean {
        let leaf = this.app.workspace.activeLeaf;
        let view = leaf.view;
        if (leaf) {
            const result = view instanceof MarkdownView && view.currentMode instanceof MarkdownSourceView;
            if (result && !checking) {
                innerFn.call(this);
            }
            return result;
        }
        return false;
    };
}


export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;
    cm: CodeMirror.Editor;

    async onload() {
        await this.loadSettings();
        const plugin = this;

        this.addCommand({
            id: 'insert-remarkable-drawing',
            name: 'Insert a drawing from the reMarkable',
            callback: () => {
                plugin.tryInsertingDrawing(false)
            }
        });

        this.addCommand({
            id: 'insert-remarkable-drawing-landscape',
            name: 'Insert a landscape-format drawing from the reMarkable',
            callback: () => {
                plugin.tryInsertingDrawing(true)
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
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async runProcess(executable_path: string, args: string[]): Promise<Record<'stderr' | 'stdout', string>> {
        let outputs: Record<'stderr' | 'stdout', string> = {
            'stderr': '',
            'stdout': ''
        };
        return new Promise(function (resolve, reject) {
            const process = spawn(executable_path, args);
            process.stdout.on('data', (data: string) => { outputs.stdout += data; });
            process.stderr.on('data', (data: string) => { outputs.stderr += data; });

            process.on('close', async function (code: number) {
                if(code === 0) {
                    resolve(outputs);
                }
                else {
                    reject("Nonzero exitcode.\nSTDERR: " + outputs.stderr
                        + "\nSTDOUT: " + outputs.stdout);
                }
            });
            process.on('error', function (err: string) {
                reject(err);
            });
        });
    }

    async callReSnap(landscape: boolean) {
        const { reSnapPath, rmAddress } = this.settings;
        const { spawn } = require('child_process');

        let vaultAbsPath;
        const adapter = this.app.vault.adapter;
        if (adapter instanceof FileSystemAdapter) {
            vaultAbsPath = adapter.getBasePath();
        }
        else {
            // Not on desktop, thus there is no basePath available. Cancel execution.
            new Notice('Could not get vault path! Is this running on mobile...?');
            return;
        }

        const now = moment();
        const drawingFileName = `rM drawing ${now.format("YYYY-MM-DD-HH.mm.ss")}.png`;
        const absOutputFolderPath = adapter.getFullRealPath(this.settings.outputPath);
        const drawingFilePath = path.join(absOutputFolderPath, drawingFileName);

        let args = ['-o', drawingFilePath, '-s', rmAddress];
        if(landscape) {
            args = args.concat(['-l']);
        }

        const { stderr, stdout } = await this.runProcess(reSnapPath, args);
        return { drawingFilePath, drawingFileName };
    }

    async postprocessDrawing(drawingFilePath: string) {
        const { postprocessor } = this.settings;
        if (postprocessor) {
            const args = [drawingFilePath];
            const { stderr, stdout } = await this.runProcess(postprocessor, args);
        }
        return true;
    }

    async tryInsertingDrawing(landscape: boolean) {
        let success = false;
        new Notice('Inserting rM drawing...', 1000);

        try {
            // remember the editor here, so the user could change mode (e.g. preview mode)
            // in the meantime without an error
	    const editor = this.editor;
            const { drawingFilePath, drawingFileName } = await this.callReSnap(landscape);
            await this.postprocessDrawing(drawingFilePath); // no-op if no postprocessor set

            editor.replaceRange(`![[${drawingFileName}]]`, editor.getCursor());
            new Notice('Inserted your rM drawing!');
            return true;
        } catch(error) {
            new Notice('Could not insert your rM drawing! Is your tablet connected ' +
                       'and reachable at the configured address?');
            throw error;
            return false;
        }
    }

    /* Taken and adapted from hans/obsidian-citation-plugin. Cheers! */
    get editor(): Editor {
        const view = this.app.workspace.activeLeaf.view;
        try {
            if (view.editMode.type == "source") {
                return view.editor;
            }
	    else {
		return null;
	    }
        }
        catch (error) {
            return null;
        }
    }

    /* Taken from hans/obsidian-citation-plugin. Cheers! */
    resolveLibraryPath(rawPath: string): string {
        const vaultRoot =
            this.app.vault.adapter instanceof FileSystemAdapter
            ? this.app.vault.adapter.getBasePath()
            : '/';
        return path.resolve(vaultRoot, rawPath);
    }
}

class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;
    outputPathInfo: HTMLElement;
    outputPathError: HTMLElement;
    outputPathSuccess: HTMLElement;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * Taken and modified from hans/obsidian-citation-plugin. Cheers!
     * Returns true iff the path exists (relative to the vault directory).
     * Displays error/success/info in the settings as a side-effect.
     */
    async checkOutputFolder(outputFolder: string): Promise<boolean> {
        this.outputPathInfo.addClass('d-none');

        try {
            const adapter = this.app.vault.adapter;
            if (adapter instanceof FileSystemAdapter) {
                const resolvedPath = outputFolder;//this.plugin.resolveLibraryPath(outputFolder);
                const stat = await adapter.stat(resolvedPath);
                if(stat.type !== 'folder') { throw new Error('Chosen output folder is not a folder!'); }
            }
            else {
                throw new Error('Could not get FileSystemAdapter! Is this running on mobile...?');
            }
        } catch (e) {
            this.outputPathSuccess.style.display = "none";
            this.outputPathError.style.display = "block";
            return false;
        } finally {
            this.outputPathInfo.style.display = "none";
        }

        return true;
    }

    display(): void {
        let {containerEl} = this;

        containerEl.empty();
        containerEl.createEl('h2', {text: 'Obsidian & reMarkable'});

        new Setting(containerEl)
            .setName('reMarkable IP')
            .setDesc('The IP address of your reMarkable. Use 10.11.99.1 and connect via cable if unsure.')
            .addText(text => text
            .setPlaceholder('Example: 10.11.99.1')
            .setValue(this.plugin.settings.rmAddress)
            .onChange(async (value) => {
                this.plugin.settings.rmAddress = value;
                await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
            .setName('reSnap executable')
            .setDesc('The path to the reSnap executable')
            .addText(text => text
            .setPlaceholder('Paste in the absolute path to reSnap.sh')
            .setValue(this.plugin.settings.reSnapPath)
            .onChange(async (value) => {
                this.plugin.settings.reSnapPath = value;
                await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
            .setName('Output folder')
            .setDesc('The folder where rM drawing images should be stored')
            .addText(text => text
            .setPlaceholder('Some folder from your Vault')
            .setValue(this.plugin.settings.outputPath)
            .onChange(async (value) => {
                let success = await this.checkOutputFolder(value);
                if(success) {
                    this.plugin.settings.outputPath = value;
                    await this.plugin.saveSettings();
                    this.outputPathError.style.display = "none";
                    this.outputPathSuccess.style.display = "block";
                }
            }));
        this.outputPathInfo = containerEl.createEl('p', {
            cls: 'remarkable-output-path-info d-none',
            text: 'Checking output folder...',
        });
        this.outputPathError = containerEl.createEl('p', {
            cls: 'remarkable-output-path-error d-none',
            text: 'The output folder does not seem to exist. ' +
                  'Please type in a path to a folder that exists inside the vault.'
        });
        this.outputPathSuccess = containerEl.createEl('p', {
            cls: 'remarkable-output-path-success d-none',
            text: 'Successfully set the output folder.',
        });
        this.outputPathInfo.style.display = "none";
        this.outputPathError.style.display = "none";
        this.outputPathSuccess.style.display = "none";

        new Setting(containerEl)
            .setName('Postprocessing script')
            .setDesc('The absolute path to a script that post-processes the captured image. ' +
                'The script will be passed the filename and should overwrite the file with a modified version.')
            .addText(text => text
            .setPlaceholder('/some/path/to/some/script')
            .setValue(this.plugin.settings.postprocessor)
            .onChange(async (value) => {
                this.plugin.settings.postprocessor = value;
                await this.plugin.saveSettings();
            }));
    }
}
