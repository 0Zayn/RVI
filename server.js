const Express = require('express');
const Axios = require('axios');
const App = Express();

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

App.listen(10005, () => {
    console.log('Server started on port 10005');
});
