'use strict';
import { CancellationTokenSource, commands, Disposable, QuickPickItem, QuickPickOptions, Uri, window } from 'vscode';
import { Commands, Keyboard, KeyboardScope, KeyMapping, openEditor } from '../commands';
// import { Logger } from '../logger';

export function showQuickPickProgress(message: string, mapping?: KeyMapping, delay: boolean = false): CancellationTokenSource {
    const cancellation = new CancellationTokenSource();

    if (delay) {
        let disposable: Disposable;
        const timer = setTimeout(() => {
            disposable && disposable.dispose();
            _showQuickPickProgress(message, cancellation, mapping);
        }, 250);
        disposable = cancellation.token.onCancellationRequested(() => clearTimeout(timer));
    }
    else {
        _showQuickPickProgress(message, cancellation, mapping);
    }

    return cancellation;
}

async function _showQuickPickProgress(message: string, cancellation: CancellationTokenSource, mapping?: KeyMapping) {
        // Logger.log(`showQuickPickProgress`, `show`, message);

        const scope: KeyboardScope = mapping && await Keyboard.instance.beginScope(mapping);

        try {
            await window.showQuickPick(_getInfiniteCancellablePromise(cancellation), {
                placeHolder: message
            } as QuickPickOptions, cancellation.token);
        }
        catch (ex) {
            // Not sure why this throws
        }
        finally {
            // Logger.log(`showQuickPickProgress`, `cancel`, message);

            cancellation.cancel();
            scope && scope.dispose();
        }
}

function _getInfiniteCancellablePromise(cancellation: CancellationTokenSource) {
    return new Promise<QuickPickItem[]>((resolve, reject) => {
        const disposable = cancellation.token.onCancellationRequested(() => {
            disposable.dispose();
            resolve([]);
        });
    });
}

export class CommandQuickPickItem implements QuickPickItem {

    label: string;
    description: string;
    detail: string;
    protected command: Commands | undefined;
    protected args: any[];

    constructor(item: QuickPickItem, args?: [Commands, any[]]);
    constructor(item: QuickPickItem, command?: Commands, args?: any[]);
    constructor(item: QuickPickItem, commandOrArgs?: Commands | [Commands, any[]], args?: any[]) {
        if (commandOrArgs === undefined) {
            this.command = undefined;
            this.args = args;
        }
        else if (typeof commandOrArgs === 'string') {
            this.command = commandOrArgs;
            this.args = args;
        }
        else {
            this.command = commandOrArgs[0];
            this.args = commandOrArgs.slice(1);
        }
        Object.assign(this, item);
    }

    execute(): Thenable<{}> {
        return commands.executeCommand(this.command, ...(this.args || []));
    }
}

export class KeyCommandQuickPickItem extends CommandQuickPickItem {

    constructor(command: Commands, args?: any[]) {
        super({ label: undefined, description: undefined }, command, args);
    }
}

export class OpenFileCommandQuickPickItem extends CommandQuickPickItem {

    constructor(public uri: Uri, item: QuickPickItem) {
        super(item, undefined, undefined);
    }

    async execute(pinned: boolean = false): Promise<{}> {
        return this.open(pinned);
    }

    async open(pinned: boolean = false): Promise<{} | undefined> {
        return openEditor(this.uri, pinned);
    }
}

export class OpenFilesCommandQuickPickItem extends CommandQuickPickItem {

    constructor(public uris: Uri[], item: QuickPickItem) {
        super(item, undefined, undefined);
    }

    async execute(): Promise<{}> {
        for (const uri of this.uris) {
            await openEditor(uri, true);
        }
        return undefined;
    }
}