const FileDestination = { // Packages by default are just not organized into the default Roblox file structure, so we have to do it
    'extracontent-luapackages.zip': 'ExtraContent/LuaPackages',
    'extracontent-models.zip': 'ExtraContent/models',
    'extracontent-places.zip': 'ExtraContent/places',
    'extracontent-textures.zip': 'ExtraContent/textures',
    'extracontent-translations.zip': 'ExtraContent/translations',

    'content-platform-fonts.zip': 'PlatformContent/pc/fonts',
    'content-platform-dictionaries.zip': 'PlatformContent/pc/shared_compression_dictionaries',
    'content-terrain.zip': 'PlatformContent/pc/terrain',
    'content-textures3.zip': 'PlatformContent/pc/textures',

    'content-avatar.zip': 'content/avatar',
    'content-configs.zip': 'content/configs',
    'content-fonts.zip': 'content/fonts',
    'content-models.zip': 'content/models',
    'content-sky.zip': 'content/sky',
    'content-sounds.zip': 'content/sounds',
    'content-textures2.zip': 'content/textures',

    'redist.zip': '',
    'RobloxApp.zip': '',
    'WebView2.zip': '',

    'shaders.zip': 'shaders',
    'ssl.zip': 'ssl',
    'WebView2RuntimeInstaller.zip': 'WebView2RuntimeInstaller'
};

class Installer {
    constructor() {
        this.Version = new URLSearchParams(window.location.search).get('Version');

        this.Logs = document.getElementById('Logs');
        this.ProgressBar = document.getElementById('ProgressBar');

        this.FinalZip = new JSZip();
        this.MaxParallel = Math.min(navigator.hardwareConcurrency * 4 || 16, 32);
        
        this.StartTime = Date.now();

        this.CompletedFiles = 0;
        this.TotalFiles = 0;
        
        document.getElementById('VersionTitle').textContent = `Installing Roblox: ${this.Version}`;
    }

    UpdateLog(Message, Type = 'Info') {
        const LogEntry = document.createElement('div');

        LogEntry.className = `LogEntry Log${Type}`;
        LogEntry.textContent = Message;
        
        this.Logs.appendChild(LogEntry);
        window.scrollTo(0, document.body.scrollHeight);
    }

    UpdateProgress() {
        const Progress = (this.CompletedFiles / this.TotalFiles) * 100;
        this.ProgressBar.style.width = `${Math.min(Progress, 100)}%`;
    }

    async ProcessFile(File) {
        try {
            const Response = await fetch(`https://setup-cfly.rbxcdn.com/${this.Version}-${File}`, { // Has CORs policies that will not cause issues with our installation
                headers: { 'Accept': 'application/zip' },
                cache: 'force-cache'
            });

            const Data = await Response.arrayBuffer();
            const Zip = await JSZip.loadAsync(Data);
            const DestFolder = FileDestination[File];

            const Promises = Object.entries(Zip.files).filter(([, Entry]) => !Entry.dir).map(async ([Path, Entry]) => {
                const FinalPath = DestFolder ? `${DestFolder}/${Path}` : Path;
                this.FinalZip.file(FinalPath, await Entry.async('uint8array'), { compression: 'STORE' });
            });

            await Promise.all(Promises);

            this.CompletedFiles++;
            this.UpdateProgress();
            this.UpdateLog(`Successfully processed: ${File}`, 'Success');
        } catch (Error) {
            this.UpdateLog(`Error processing: ${File} - ${Error.message}`, 'Error');
        }
    }

    async Start() {
        try {
            const { Manifest } = await (await fetch(`/ManifestData/${this.Version}`)).json(); // Manifest file containing all the packages for Roblox
            const Files = Manifest.split('\n').filter((_, i) => i % 4 === 1).map(line => line.trim()).filter(line => line && !line.includes('RobloxPlayerLauncher.exe')); // We don't need the launcher so it can be filtered out, Roblox runs without it

            this.TotalFiles = Files.length;
            this.UpdateLog(`Found ${this.TotalFiles} packages to download`, 'Info'); // Usually around 22

            const Chunks = [];
            for (let i = 0; i < Files.length; i += this.MaxParallel) 
                Chunks.push(Files.slice(i, i + this.MaxParallel));

            const Batches = Chunks.map(Chunk =>
                Promise.all(Chunk.map(File => this.ProcessFile(File)))
            );

            await Promise.all(Batches);

            await this.FinalZip.file('AppSettings.xml', '<?xml version="1.0" encoding="UTF-8"?><Settings><ContentFolder>content</ContentFolder><BaseUrl>http://www.roblox.com</BaseUrl></Settings>'); // We need to create this for Roblox to run
            this.UpdateLog('Creating final package...', 'Info');

            const Content = await this.FinalZip.generateAsync({ type: 'blob', compression: 'STORE' });
            const Link = document.createElement('a');

            Link.href = URL.createObjectURL(Content);
            Link.download = `${this.Version}-RobloxApp.zip`;

            Link.click();

            this.UpdateLog(`Total time: ${((Date.now() - this.StartTime) / 1000).toFixed(2)} seconds`, 'Success');
            setTimeout(() => URL.revokeObjectURL(Link.href), 60000);
        } catch (Error) {
            this.UpdateLog(`Installation failed: ${Error.message}`, 'Error');
        }
    }
}

const Script = document.createElement('script');

Script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js'; // Older version is faster
Script.onload = () => new Installer().Start();

document.head.appendChild(Script);