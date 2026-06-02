// Translations for SoloForge
export const translations = {
    en: {
        // Header
        title: 'SoloForge',
        subtitle: 'Solo Bitcoin Mining',
        connected: 'Connected',
        disconnected: 'Disconnected',
        startMining: 'Start Mining',
        stopMining: 'Stop Mining',

        // Hero
        heroTitle: 'Chase the',
        heroTitleHighlight: 'Block Reward',
        heroDescription: 'Solo mining means going for the jackpot — a full block reward of 3.125 BTC. The odds are astronomical, but someone has to win. Why not you?',

        // Stats
        hashrate: 'Hashrate',
        totalHashes: 'Total Hashes',
        sharesFound: 'Shares Found',
        sharesExplanation: 'Partial proofs of work',
        sharesTooltip: 'Shares are partial solutions that prove your miner is working. They are too weak to win a block but demonstrate mining activity.',
        bestDifficulty: 'Best Difficulty',
        difficultyTooltip: 'The highest difficulty hash you have found. Network requires ~75 trillion. With CPU mining, this grows very slowly over hours/days.',
        updatesEverySecond: 'Updates every second',
        computing: '🔄 Computing...',
        startMiningPrompt: 'Start mining',
        waitingForShares: 'Waiting for shares',
        accepted: 'accepted',
        searching: 'Searching...',
        ofNetwork: '% of network',

        // Workers
        workersTitle: '⛏️ Mining Workers',
        addWorker: '+ Add Worker',
        workersExplanation: '= parallel mining threads. The initial number is set in configuration, but you can add/remove here during mining. More workers = more hashrate, but also more CPU load.',
        workers: 'Workers',
        workersActive: 'workers active',
        noActiveWorkers: 'No active workers. Start mining to create workers!',
        active: 'Active',
        stopped: 'Stopped',

        // Settings
        configTitle: '⚙️ Configuration',
        walletAddress: 'Bitcoin Wallet Address',
        walletPlaceholder: 'Enter your BTC wallet address...',
        poolUrl: 'Pool URL',
        poolPort: 'Pool Port',
        cpuLimit: 'CPU Usage Limit',
        cpuLimitHelp: 'Limits overall CPU load. Can be changed during mining.',
        initialWorkers: 'Initial Workers',
        initialWorkersHelp: 'Number of workers created at startup. You can add/remove dynamically after.',
        saveSettings: 'Save',

        // Live Log
        liveActivity: '📡 Live Activity',
        startMiningToSee: 'Start mining to see live activity...',

        // History
        historyTitle: '📜 Share History',
        noSharesYet: 'No shares found yet.',
        noSharesExplanation: '💡 CPU mining generates very low hashrate. Finding shares with significant difficulty can take hours or even days. This is normal!',
        time: 'Time',
        worker: 'Worker',
        difficulty: 'Difficulty',
        status: 'Status',
        sessionsTitle: '🕒 Mining Sessions',
        sessions: 'Sessions',
        duration: 'Duration',
        startTime: 'Start Time',

        // Footer
        pool: 'Pool',
        uptime: 'Uptime',

        // Log messages
        logMining: '⛏️ Mining...',
        logSearching: '🔍 Searching for valid nonce...',
        logHashes: '💎 Hashes computed:',
        logBestDiff: '🎯 Best difficulty:',
        logStarting: '🚀 Starting mining...',
        logStarted: '✅ Mining started!',
        logConnectedTo: '📡 Connected to',
        logStopping: '🛑 Stopping mining...',
        logStopped: 'Mining stopped',
        logConfigSaved: '✅ Settings saved!',
        logConfigFailed: '❌ Failed to save',
        logStartFailed: '❌ Failed to start mining',
        logNewShare: '⚡ New share found!',
        logWorkerAdded: '➕ Worker added',
        logWorkerRemoved: '➖ Worker removed',
        logNewJob: 'New job received:',
        logNewBlock: 'New block detected on network!',

        // Alerts
        enterWalletFirst: 'Please enter your Bitcoin wallet address first!',

        // Demo banner
        demoBannerLabel: 'DEMO —',
        demoBannerText: 'Mining runs entirely in your browser (real SHA-256d proof-of-work on a real Bitcoin block from mempool.space). No backend, and it will not realistically find a block. The real version mines server-side in Go via the Stratum protocol.',
    },

    fr: {
        // Header
        title: 'SoloForge',
        subtitle: 'Mining Bitcoin Solo',
        connected: 'Connecté',
        disconnected: 'Déconnecté',
        startMining: 'Démarrer',
        stopMining: 'Arrêter',

        // Hero
        heroTitle: 'Tentez le',
        heroTitleHighlight: 'Jackpot',
        heroDescription: 'Le solo mining, c\'est viser le gros lot — une récompense complète de 3.125 BTC. Les chances sont infimes, mais quelqu\'un doit gagner. Pourquoi pas vous ?',

        // Stats
        hashrate: 'Hashrate',
        totalHashes: 'Total Hashes',
        sharesFound: 'Shares Trouvées',
        sharesExplanation: 'Preuves partielles de travail',
        sharesTooltip: 'Les shares sont des solutions partielles qui prouvent que votre miner travaille. Trop faibles pour gagner un bloc, elles démontrent l\'activité de mining.',
        bestDifficulty: 'Meilleure Difficulté',
        difficultyTooltip: 'Le hash de plus haute difficulté trouvé. Le réseau nécessite ~75 billions. En CPU mining, cela augmente très lentement sur des heures/jours.',
        updatesEverySecond: 'Mise à jour chaque seconde',
        computing: '🔄 Calcul en cours...',
        startMiningPrompt: 'Démarrer le mining',
        waitingForShares: 'En attente de shares',
        accepted: 'acceptées',
        searching: 'Recherche...',
        ofNetwork: '% du réseau',

        // Workers
        workersTitle: '⛏️ Workers de Mining',
        addWorker: '+ Ajouter',
        workersExplanation: '= threads de mining parallèles. Le nombre initial est défini dans la configuration, mais vous pouvez en ajouter/supprimer ici pendant le mining. Plus de workers = plus de hashrate, mais aussi plus de charge CPU.',
        workers: 'Workers',
        workersActive: 'workers actifs',
        noActiveWorkers: 'Aucun worker actif. Démarrez le mining pour créer des workers !',
        active: 'Actif',
        stopped: 'Arrêté',

        // Settings
        configTitle: '⚙️ Configuration',
        walletAddress: 'Adresse Wallet Bitcoin',
        walletPlaceholder: 'Entrez votre adresse BTC...',
        poolUrl: 'URL du Pool',
        poolPort: 'Port du Pool',
        cpuLimit: 'Limite CPU',
        cpuLimitHelp: 'Limite la charge CPU globale. Peut être modifié pendant le mining.',
        initialWorkers: 'Workers Initiaux',
        initialWorkersHelp: 'Nombre de workers créés au démarrage. Vous pouvez en ajouter/supprimer après.',
        saveSettings: 'Sauvegarder',

        // Live Log
        liveActivity: '📡 Activité en Direct',
        startMiningToSee: 'Démarrez le mining pour voir l\'activité...',

        // History
        historyTitle: '📜 Historique des Shares',
        noSharesYet: 'Aucune share trouvée pour le moment.',
        noSharesExplanation: '💡 Le mining CPU génère un très faible hashrate. Trouver des shares avec une difficulté significative peut prendre des heures, voire des jours. C\'est normal !',
        time: 'Heure',
        worker: 'Worker',
        difficulty: 'Difficulté',
        status: 'Statut',
        sessionsTitle: '🕒 Sessions de Mining',
        sessions: 'Sessions',
        duration: 'Durée',
        startTime: 'Heure de début',

        // Footer
        pool: 'Pool',
        uptime: 'Uptime',

        // Log messages
        logMining: '⛏️ Mining...',
        logSearching: '🔍 Recherche d\'un nonce valide...',
        logHashes: '💎 Hashes calculés :',
        logBestDiff: '🎯 Meilleure difficulté :',
        logStarting: '🚀 Démarrage du mining...',
        logStarted: '✅ Mining démarré !',
        logConnectedTo: '📡 Connecté à',
        logStopping: '🛑 Arrêt du mining...',
        logStopped: 'Mining arrêté',
        logConfigSaved: '✅ Configuration sauvegardée !',
        logConfigFailed: '❌ Échec de la sauvegarde',
        logStartFailed: '❌ Échec du démarrage',
        logNewShare: '⚡ Nouvelle share trouvée !',
        logWorkerAdded: '➕ Worker ajouté',
        logWorkerRemoved: '➖ Worker supprimé',
        logNewJob: 'Nouveau job reçu :',
        logNewBlock: 'Nouveau bloc détecté sur le réseau !',

        // Alerts
        enterWalletFirst: 'Veuillez d\'abord entrer votre adresse wallet Bitcoin !',

        // Demo banner
        demoBannerLabel: 'DÉMO —',
        demoBannerText: 'Le mining tourne entièrement dans votre navigateur (vrai proof-of-work SHA-256d sur un bloc Bitcoin réel issu de mempool.space). Aucun backend, et cela ne trouvera pas de bloc de façon réaliste. La vraie version mine côté serveur en Go via le protocole Stratum.',
    }
};

export const getTranslation = (lang, key) => {
    return translations[lang]?.[key] || translations.en[key] || key;
};
