const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

function MyDesklet(metadata, desklet_id) {
    this._init(metadata, desklet_id);
}

MyDesklet.prototype = Object.create(Desklet.Desklet.prototype);
MyDesklet.prototype._init = function(metadata, desklet_id) {
    Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);

    // Default values
    this.custom_text = "Hello, Desktop!";
    this.text_color = "#ffffff";

    // Settings
    this.settings = new Settings.DeskletSettings(this, metadata.uuid, desklet_id);
    this.settings.bind("custom-text", "custom_text", this._onSettingsChanged.bind(this));
    this.settings.bind("text-color", "text_color", this._onSettingsChanged.bind(this));
    this.settings.bind("enable-time", "enable_time", this._onSettingsChanged.bind(this));
    this.settings.bind("use-24h", "use_24h", this._onSettingsChanged.bind(this));
    this.settings.bind("time-color", "time_color", this._onSettingsChanged.bind(this));
    this.settings.bind("day-color", "day_color", this._onSettingsChanged.bind(this));
    this.settings.bind("sunday-color", "sunday_color", this._onSettingsChanged.bind(this));
    this.settings.bind("monthyear-color", "monthyear_color", this._onSettingsChanged.bind(this));
    this.settings.bind("countdown-color", "countdown_color", this._onSettingsChanged.bind(this));
    this.settings.bind("quote-color", "quote_color", this._onSettingsChanged.bind(this));
    
    // New settings
    this.settings.bind("enable-countdown", "enable_countdown", this._onSettingsChanged.bind(this));
    this.settings.bind("countdown-title", "countdown_title", this._onSettingsChanged.bind(this));
    this.settings.bind("countdown-date", "countdown_date", this._onSettingsChanged.bind(this));
    this.settings.bind("enable-quote", "enable_quote", this._onSettingsChanged.bind(this));

    // UI
    this._buildUI();
    this._updateUI();
};

MyDesklet.prototype._buildUI = function() {
    this._container = new St.BoxLayout({ 
        vertical: true,
        style_class: 'desklet-container'
    });

    // Main custom text
    this._label = new St.Label({ style_class: 'desklet-main-label' });
    this._container.add_actor(this._label);

    // Current Time
    this._timeLabel = new St.Label({ style_class: 'desklet-timer' });
    if (this.enable_time) {
        this._container.add_actor(this._timeLabel);
    }

    // Date (Monday)
    this._dateLabel = new St.Label({ style_class: 'desklet-day-label' });
    this._container.add_actor(this._dateLabel);

    // Month and year
    this._monthYearLabel = new St.Label({ style_class: 'desklet-monthyear-label' });
    this._container.add_actor(this._monthYearLabel);

    // Countdown timer
    this._countdownLabel = new St.Label({ style_class: 'desklet-countdown-label' });
    if (this.enable_countdown) {
        this._container.add_actor(this._countdownLabel);
    }

    // Quote container and label
    this._quoteContainer = new St.Bin({ style_class: 'quote-container' });
    this._quoteLabel = new St.Label({ style_class: 'desklet-quote-label' });
    this._quoteContainer.set_child(this._quoteLabel);
    if (this.enable_quote) {
        this._container.add_actor(this._quoteContainer);
    }

    this.setContent(this._container);
    
    // Load quotes from JSON file
    this._loadQuotes();
    
    // Set initial quote
    this._updateQuote();
};

MyDesklet.prototype._updateUI = function() {
    // Get current date/time
    let now = new Date();

    // Update custom text and color
    this._label.set_text(this.custom_text);
    this._label.style = `color: ${this.text_color};`;
    
    // Update time if enabled
    if (this.enable_time) {
        let timeString = now.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: !this.use_24h
        });
        this._timeLabel.set_text(timeString);
        this._timeLabel.style = `color: ${this.time_color};`;
        this._timeLabel.visible = true;
    } else {
        this._timeLabel.visible = false;
    }
    this._dateLabel.style = `color: ${this.day_color};`;
    this._monthYearLabel.style = `color: ${this.monthyear_color};`;
    this._countdownLabel.style = 
        `color: ${this.countdown_color}; border-color: ${this.countdown_color}40;`; // 40 is for 25% opacity
    this._quoteLabel.style = `color: ${this.quote_color};`;

    // Day name
    let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let dayName = days[now.getDay()];
    this._dateLabel.set_text(dayName);

    // Apply special style for Sunday
    if (now.getDay() === 0) {
        this._dateLabel.style = `color: ${this.sunday_color}; font-size: 100px; font-weight: 900;`;
    } else {
        this._dateLabel.style = `color: ${this.day_color};`;
    }

    // Update month and year
    let months = ["January", "February", "March", "April", "May", "June", 
                 "July", "August", "September", "October", "November", "December"];
    let monthYear = months[now.getMonth()] + " " + now.getFullYear();
    this._monthYearLabel.set_text(monthYear);

    // Update countdown if enabled
    if (this.enable_countdown) {
        try {
            let target = new Date(this.countdown_date + "T00:00:00");
            let diff = target - now;

            if (diff > 0) {
                let daysLeft = Math.floor(diff / (1000 * 60 * 60 * 24));
                let hoursLeft = Math.floor((diff / (1000 * 60 * 60)) % 24);
                let minsLeft = Math.floor((diff / (1000 * 60)) % 60);
                let secsLeft = Math.floor((diff / 1000) % 60);
                
                // Format countdown with padding for consistent width
                let countdown = `${this.countdown_title}: ${daysLeft.toString().padStart(3)}d ` +
                            `${hoursLeft.toString().padStart(2)}h ` +
                            `${minsLeft.toString().padStart(2)}m ` +
                            `${secsLeft.toString().padStart(2)}s`;
                
                this._countdownLabel.set_text(countdown);
            } else {
                this._countdownLabel.set_text(`${this.countdown_title}: Event Started!`);
            }
        } catch (e) {
            this._countdownLabel.set_text("Invalid date format. Use YYYY-MM-DD");
        }

        // Show/hide countdown based on setting
        this._countdownLabel.visible = true;
    } else {
        this._countdownLabel.visible = false;
    }

    // Show/hide quote based on setting
    if (this._quoteContainer) {
        this._quoteContainer.visible = this.enable_quote;
    }

    // Update quote if needed
    let currentMinute = now.getMinutes();
    if (!this._lastQuoteMinute || this._lastQuoteMinute !== currentMinute) {
        if (currentMinute % 30 === 0) { // Update quote every 30 minutes
            this._updateQuote();
        }
        this._lastQuoteMinute = currentMinute;
    }

    // Update every second
    if (this._timeoutId) {
        Mainloop.source_remove(this._timeoutId);
    }
    this._timeoutId = Mainloop.timeout_add_seconds(1, () => {
        this._updateUI();
        return true;
    });
};

MyDesklet.prototype._loadQuotes = function() {
    try {
        // Get the path to quotes.json
        let quotesPath = GLib.build_filenamev([this.metadata.path, "quotes.json"]);
        let file = Gio.File.new_for_path(quotesPath);
        
        // Read the file content
        let [success, content] = file.load_contents(null);
        if (!success) {
            global.logError("Failed to load quotes.json");
            return;
        }

        // Parse JSON content
        let jsonContent = JSON.parse(new TextDecoder().decode(content));
        this.quotes = jsonContent;
    } catch (e) {
        global.logError("Error loading quotes: " + e);
        // Fallback quotes in case of error
        this.quotes = [{
            quoteText: "Every day is a new beginning",
            quoteAuthor: "Anonymous"
        }];
    }
};

MyDesklet.prototype._updateQuote = function() {
    const randomIndex = Math.floor(Math.random() * this.quotes.length);
    const quote = this.quotes[randomIndex];
    let displayText = '"' + quote.quoteText + '"';
    if (quote.quoteAuthor && quote.quoteAuthor.length > 0) {
        displayText += "\n— " + quote.quoteAuthor;
    }
    this._quoteLabel.set_text(displayText);
};

MyDesklet.prototype._onSettingsChanged = function() {
    this._updateUI();
};

function main(metadata, desklet_id) {
    return new MyDesklet(metadata, desklet_id);
}