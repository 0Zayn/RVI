const Express = require('express');
const Axios = require('axios');
const Path = require('path');
const Fs = require('fs');
const { WebhookClient } = require('discord.js');

const WebhookUrl = 'https://discord.com/api/webhooks/1315131384750149743/Bgbsrqd5lVCahrz78kBAWm4nZNNVnSpJ_vfnUIhrRV_DQaf1eZ2ffMbzmcnXTwrWpU1_';
const Client = new WebhookClient({ url: WebhookUrl });

const StateFile = Path.join(__dirname, 'MonitorState.json');

const App = Express();
let State = LoadState();

function LoadState() {
    try {
        return Fs.existsSync(StateFile)  ? JSON.parse(Fs.readFileSync(StateFile)) : { LastDeploy: null, LastClient: null, LastNotification: null };
    } catch {
        return { LastDeploy: null, LastClient: null, LastNotification: null };
    }
}

function SaveState() {
    Fs.writeFileSync(StateFile, JSON.stringify(State));
}

App.use((Req, Res, Next) => {
    Res.header('Access-Control-Allow-Origin', '*');
    Res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    Res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    Next();
});

App.use(Express.static('public'));

App.get('/Install', (Req, Res) => {
    Res.sendFile(Path.join(__dirname, 'public', 'index.html'));
});

App.get('/ManifestData/:Version', async (Req, Res) => {
    try {
        const Response = await Axios.get(`https://setup.rbxcdn.com/${Req.params.Version}-rbxPkgManifest.txt`);
        Res.json({ Manifest: Response.data });
    } catch (Error) {
        Res.status(500).json({ Error: Error.message });
    }
});

const NotifyUpdate = async (Title, Details) => {
    const CurrentTime = Date.now();

    try {
        const ApiLink = `https://roblox.get-fusion.com/Install?Version=${Details.Version}`;
        const IsOfficial = Details.Type.includes('Release');
        
        await Client.send({
            embeds: [{
                title: Title,
                description: `**New Version Available!**\n\n🎯 **Version:** ${Details.Version}\n📅 **Release Date:** ${Details.Date}\n📋 **Type:** ${Details.Type}`,
                color: IsOfficial ? 0x2ecc71 : 0x3498db,
                footer: { text: 'Roblox Version Monitor - Made by Zayn' },
                timestamp: new Date(),
                fields: [{
                    name: 'Installation Link',
                    value: `[Click to Install](${ApiLink})`,
                    inline: true
                }]
            }]
        });

        State.LastNotification = CurrentTime;
        SaveState();
    } catch (Error) {
        console.error('Discord notification error:', Error);
    }
};

const Monitor = () => {
    const CheckVersions = async () => {
        try {
            const [DeployResponse, ClientResponse] = await Promise.all([
                Axios.get('http://setup.roblox.com/DeployHistory.txt', { 
                    headers: { Range: 'bytes=-512' },
                    timeout: 5000 
                }),
                Axios.get('https://clientsettingscdn.roblox.com/v2/client-version/WindowsPlayer/channel/LIVE', { 
                    timeout: 5000 
                })
            ]);

            const DeployData = DeployResponse.data?.split('\n').reverse().find(Line => Line.includes('New WindowsPlayer'))?.split(' ');

            const LatestDeploy = DeployData?.[2];
            const ReleaseDate = DeployData ? DeployData.slice(4).join(' ').split(',')[0] : new Date().toLocaleString();

            const ClientVersion = ClientResponse.data?.clientVersionUpload;

            if (LatestDeploy && LatestDeploy !== State.LastDeploy) {
                await NotifyUpdate('🚀 New Build', { 
                    Version: LatestDeploy, 
                    Type: 'Internal Build',
                    Date: ReleaseDate
                });
                State.LastDeploy = LatestDeploy;
                SaveState();
            }

            if (ClientVersion && ClientVersion !== State.LastClient) {
                await NotifyUpdate('🌐 Official Update', { 
                    Version: ClientVersion, 
                    Type: 'Roblox Release',
                    Date: new Date().toLocaleString()
                });
                State.LastClient = ClientVersion;
                SaveState();
            }
        } catch (Error) {
            console.error('Version check error:', Error);
        }
    };

    CheckVersions();
    setInterval(CheckVersions, 60000);
};

App.listen(10005, () => {
    console.log('Server started on port 10005');
    Monitor();
});