import { Hanlder } from "@/common/handler";
import { existsSync, mkdirSync, rm, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, extname, join, parse, resolve } from "path";
import { Uri, commands, env, extensions, window, workspace } from "vscode";
import { parseZipAsTree } from "./zipUtils";
import { Output } from "@/common/Output";

export class ZipService {

    constructor(private uri: Uri, private handler: Hanlder) { }

    public async bind() {

        const handler = this.handler;
        handler.on('init', async () => {
            const data = (await workspace.fs.readFile(this.uri)) as Buffer
            const basePath = `${tmpdir()}/officeZip.${new Date().getTime()}`;
            const { zip, files, folderMap, fileMap } = parseZipAsTree(data)
            handler.emit('data', {
                files, folderMap,
                fileName: basename(this.uri.fsPath)
            }).on('open', async info => {
                const { entryName, isDirectory } = info
                if (isDirectory) {
                    handler.emit('open', entryName)
                } else {
                    await commands.executeCommand('workbench.action.keepEditor')
                    const file = fileMap[entryName]
                    const tempPath = `${basePath}/${entryName}`
                    mkdirSync(resolve(tempPath, '..'), { recursive: true })
                    writeFileSync(tempPath, file.getData())
                    const url = Uri.file(tempPath);
                    if (extname(tempPath)?.toLowerCase() == '.xlsx' && extensions.getExtension(`cweijan.vscode-office`) == null) {
                        return env.openExternal(url);
                    }
                    commands.executeCommand('vscode.open', url);
                }
            }).on('autoExtract', () => {
                window.showInformationMessage("Start extracting...")
                let target = resolve(this.uri.fsPath, '..');
                if (files.length > 1) {
                    target = join(target, parse(this.uri.fsPath).name)
                    mkdirSync(target, { recursive: true })
                }
                zip.extractAllToAsync(target, true, false, (err) => {
                    if (err) {
                        Output.debug(err)
                        window.showErrorMessage(err.message)
                    } else {
                        setTimeout(() => {
                            commands.executeCommand('revealFileInOS', Uri.file(target))
                        }, 100);
                    }
                });
            }).on('addFile', async () => {
                const uris = await window.showOpenDialog()
                if (!uris) return;
                const uri = uris[0]
                const buf = await workspace.fs.readFile(uri) as Buffer
                zip.addFile(basename(uri.fsPath), buf)
                await workspace.fs.writeFile(this.uri, zip.toBuffer())
                handler.emit('addFileDone')
            }).on('dispose', () => {
                if (existsSync(basePath)) rm(basePath, { recursive: true, force: true }, null)
            })
        })
    }

}