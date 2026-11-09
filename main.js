const { Plugin, PluginSettingTab, Setting, Notice, requestUrl, normalizePath } = require("obsidian");

const DEFAULT_SETTINGS = {
  endpoint: "https://company-os-hq.tailc157ab.ts.net:8445/api/inbox",
  token: "",
  folder: "00 · Inbox VPS"
};

class CerebroInboxSettingsTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Cerebro Inbox" });
    containerEl.createEl("p", { text: "Importa notas Markdown seleccionadas del VPS hacia esta bóveda. Las notas existentes nunca se sobrescriben." });
    new Setting(containerEl)
      .setName("URL de la bandeja")
      .addText(text => text.setValue(this.plugin.settings.endpoint).onChange(async value => {
        this.plugin.settings.endpoint = value.trim();
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl)
      .setName("Token de acceso")
      .setDesc("Se almacena sólo en esta bóveda.")
      .addText(text => text.setPlaceholder("Token privado").setValue(this.plugin.settings.token).onChange(async value => {
        this.plugin.settings.token = value.trim();
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl)
      .setName("Carpeta de destino")
      .addText(text => text.setValue(this.plugin.settings.folder).onChange(async value => {
        this.plugin.settings.folder = value.trim() || DEFAULT_SETTINGS.folder;
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl)
      .setName("Importar ahora")
      .setDesc("Crea notas nuevas; no reemplaza notas que ya existan.")
      .addButton(button => button.setButtonText("Importar desde VPS").setCta().onClick(() => this.plugin.importInbox()));
  }
}

module.exports = class CerebroInboxPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addRibbonIcon("inbox", "Importar desde VPS", () => this.importInbox());
    this.addCommand({ id: "import-from-vps", name: "Importar desde VPS", callback: () => this.importInbox() });
    this.addSettingTab(new CerebroInboxSettingsTab(this.app, this));
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  safeFilename(name) {
    return /^[^\\/]+\.md$/i.test(name) && !name.startsWith(".") ? name : null;
  }

  async ensureFolder(folder) {
    const path = normalizePath(folder);
    if (!this.app.vault.getAbstractFileByPath(path)) {
      await this.app.vault.createFolder(path);
    }
    return path;
  }

  async importInbox() {
    if (!this.settings.token) {
      new Notice("Configurá el token de Cerebro Inbox antes de importar.");
      return;
    }
    try {
      const result = await requestUrl({
        url: this.settings.endpoint,
        method: "GET",
        headers: { Authorization: "Bearer " + this.settings.token }
      });
      if (result.status !== 200 || !result.json || !Array.isArray(result.json.items)) {
        throw new Error("Respuesta inesperada de la bandeja.");
      }
      const folder = await this.ensureFolder(this.settings.folder);
      let imported = 0;
      let skipped = 0;
      for (const item of result.json.items) {
        const filename = this.safeFilename(item.filename);
        if (!filename || typeof item.content !== "string") {
          skipped++;
          continue;
        }
        const target = normalizePath(folder + "/" + filename);
        if (this.app.vault.getAbstractFileByPath(target)) {
          skipped++;
          continue;
        }
        const isExcalidraw = /\.excalidraw\.md$/i.test(filename);
        const header = isExcalidraw
          ? ""
          : "---\nsource: VPS\nsource_id: " + String(item.id || "") + "\nsource_sha256: " + String(item.sha256 || "") + "\nimported_at: " + new Date().toISOString() + "\n---\n\n";
        await this.app.vault.create(target, header + item.content);
        imported++;
      }
      new Notice("Cerebro Inbox: " + imported + " nota(s) importada(s)" + (skipped ? ", " + skipped + " omitida(s)" : "") + ".");
    } catch (error) {
      console.error("Cerebro Inbox import failed", error);
      new Notice("Cerebro Inbox no pudo importar: " + (error.message || error));
    }
  }
};
