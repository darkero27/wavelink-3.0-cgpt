/// <reference path="../../libs/js/action.js" />
/// <reference path="../../libs/js/stream-deck.js" />
/// <reference path="WaveLinkClient.js" />

class WaveLinkAction extends Action { 
    actions = new Map();
    keyTimer = new Map();
    isKeyUpdated = new Map();
    lastLevelmeterValues = new Map();

    activePI = { context: '', appearedCounter: 0};

    constructor(uuid) {

        super(uuid);

        this.wlc = new WaveLinkClient();
        this.awl = new AppWaveLink();

        // setVolume() fading interval in ms
        this.interval = 100;

        this.onWillAppear(async ({ action, context, payload, device }) => {
            const settings = payload?.settings;
            const isEncoder = payload?.controller === 'Encoder';

            if (settings.inputMixer != undefined) {
                // Update old mixer id´s
                if (settings.inputMixer == 'local') {
                    delete settings.inputMixer;
                    settings.mixerID = kPropertyMixerIDLocal;
                } else if (settings.inputMixer == 'stream') {
                    delete settings.inputMixer;
                    settings.mixerID = kPropertyMixerIDStream;
                } else if (settings.inputMixer == 'all') {
                    delete settings.inputMixer;
                    settings.mixerID = kPropertyMixerIDAll;
                }
            }

            // Converting old actions
            if (settings.actionType == undefined) {
                switch (action) {
                    case 'com.elgato.wavelink.monitormute':
                        settings.actionType = ActionType.Mute;
                        $SD.setTitle(context, '');
                        this.setSettings(context, settings);
                        break;
                    case 'com.elgato.wavelink.setvolumemonitor':
                        settings.actionType = ActionType.SetVolume;
                        this.setSettings(context, settings);
                        break;
                    case 'com.elgato.wavelink.adjustvolumemonitor':
                        settings.actionType = ActionType.AdjustVolume;
                        settings.actionStyle = 0;
                        this.setSettings(context, settings);
                        break;
                    case 'com.elgato.wavelink.mixermute':
                        settings.actionType = ActionType.Mute;
                        $SD.setTitle(context, '');
                        this.setSettings(context, settings);
                        break;
                    case 'com.elgato.wavelink.setvolumemixer':
                        settings.actionType = ActionType.SetVolume;
                        this.setSettings(context, settings);
                        break;
                    case 'com.elgato.wavelink.adjustvolumemixer':
                        settings.actionType = ActionType.AdjustVolume;
                        settings.actionStyle = 0;
                        this.setSettings(context, settings);
                        break;
                    case 'com.elgato.wavelink.seteffect':
                        settings.actionType = ActionType.SetEffect;
                        $SD.setTitle(context, '');
                        this.setSettings(context, settings);
                        break;
                    case 'com.elgato.wavelink.seteffectchain':
                        settings.actionType = ActionType.SetEffectChain;
                        this.setSettings(context, settings);
                        break;
                    case 'com.elgato.wavelink.setmicsettings':
                        settings.actionType = ActionType.SetDeviceSettings;
                        this.setSettings(context, settings);
                        break;
                    case 'com.elgato.wavelink.setmonitormixoutput':
                        settings.actionType = ActionType.SetOutput;
                        this.setSettings(context, settings);
                        break;
                    case 'com.elgato.wavelink.togglemonitormixoutput':
                        settings.actionType = ActionType.ToggleOutput;
                        this.setSettings(context, settings);
                        break;
                    case 'com.elgato.wavelink.switchmonitoring':
                        settings.actionType = ActionType.SwitchOutput;
                        this.setSettings(context, settings);
                        break;
                    default:
                        break;
                }
            }

            this.actions.set(context, { settings, device, isEncoder });

            if (isEncoder) {
                this.setFeedbackLayout(context, settings.actionStyle);
                this.setFeedback(context);
                this.setKeyIcons(context);
            } else {
                this.setKeyIcons(context);
                this.setState(context);
                this.setTitle(context);
            }
        });

        this.onWillDisappear(async ({ context }) => {
            this.actions.delete(context);
        });

        this.onDidReceiveSettings(({ context, payload }) => { 
            const { settings } = payload;

            this.actions.get(context).settings = settings;

            if (this.actions.get(context).isEncoder) {
                this.setFeedbackLayout(context, settings.actionStyle);
                this.setFeedback(context);
                this.setKeyIcons(context);
            } else {
                this.setKeyIcons(context);
                this.setState(context);
                this.setTitle(context);
            }

            this.updatePI(settings);
        });

        this.onTitleParametersDidChange(({ context, payload }) => {
            const action = this.actions.get(context);
            if (action != undefined) {
                action.title = payload?.title;
                this.setKeyIcons(context);
            }
        });

        this.onPropertyInspectorDidAppear(async ({ context }) => {
            this.setActivePI(context);
        });

        this.onPropertyInspectorDidDisappear(async ({ context }) => {
            if (this.activePI == context)
                this.resetActivePI();
        });

        this.onSendToPlugin(({ payload }) => {
            if (payload.isReady)
                this.updatePI();
         });


        this.wlc.onEvent(kPropertyUpdatePI, () => {
            this.updatePI();
        });
        
    };

    setActivePI(context) {
        if (this.activePI.context == context) {
            this.activePI.appearedCounter++;
        } else { 
            this.activePI.context = context;
        }
    }

    resetActivePI() {
        if (this.activePI.context == context && this.activePI.appearedCounter < 2) {
            this.activePI.context = '';
            this.activePI.appearedCounter = 0;
        } else {
            this.activePI.appearedCounter
        }
    }

	updatePI(newSettings) {
		if (this.activePI.context != '') {
			const isConnected	= this.wlc.isConnected;
            const apiVersion    = this.wlc.apiVersion;
			const inputs		= this.wlc.inputs;
			const outputs		= { local: this.wlc.localOutputs, stream: this.wlc.streamOutputs, selectedLocalOutput: this.wlc.selectedLocalOutput, selectedStreamOutput: this.wlc.selectedStreamOutput };
			const microphones	= this.wlc.microphones;
			const settings		= newSettings || this.actions.get(this.activePI.context)?.settings;

            if (settings?.identifier != undefined && settings?.identifier != 'Foreground App')
                settings.identifier = this.wlc.getInput(settings.identifier)?.identifier;

			$SD.sendToPropertyInspector(this.activePI.context, this.UUID, { isConnected, apiVersion, inputs, outputs, microphones, settings });
		}
	}

    setKeyIcons() {
    }
    
    setState() {
    }
    
    setTitle() {
    }

    setFeedback() {
    }

    setFeedbackVolume() {
    }

	setFeedbackLayout(context, actionStyle) {
		const singleMixerLayout = this.useLevelmeter(context, actionStyle, context) ? 'plugin/js/layouts/levelmeterSplitted.json'       : '$B1';
		const doubleMixerLayout = this.useLevelmeter(context, actionStyle, context) ? 'plugin/js/layouts/levelmeterSplittedDouble.json' : '$C1';

		$SD.send(context, "setFeedbackLayout", {
			"payload": {
				"layout": this.actions.get(context).settings.mixerID == kPropertyMixerIDAll ? doubleMixerLayout : singleMixerLayout
			} 
		});
	}

    isAppStateOk() {
        return this.wlc.isAppStateOk();
    }

    useLevelmeter(context, actionStyle, feedbackBlockedIdentifier) {
        if (this.actions.get(context).isEncoder) {
            console.log(actionStyle, feedbackBlockedIdentifier)
            switch (actionStyle) {
                case 0:
                    return this.feedbackBlocked.get(feedbackBlockedIdentifier) == undefined ? true : false;
                case 1:
                    return true;
                default:
                    return false;
            }
        } else { // Is key
            switch (actionStyle) {
                case 3:
                case 4:
                    return true;
                default:
                    return false;
            }
        }
    }

    throttleUpdate(context, time, callback) {
        if (!this.isKeyUpdated.get(context)) {
            callback(context);
            this.isKeyUpdated.set(context, true);
            _setTimeoutESD(() => {
                callback(context);
                this.isKeyUpdated.delete(context);
            }, time);
        }  
    }
    
    getInputIdentifier(context, settings) {
        if (this.wlc.inputs.length < 1)
            return settings.identifier;

        // If a valid identifier was saved...
        const input = this.wlc.inputs.find(input => input.identifier.includes(settings.identifier));
        
        if (input) {
            // ...return it...
            return input.identifier;
        } else if (settings.mixId) {
            // ...or try to get a valid identifier from the saved old identifier...
            var inputFromOldIdentifier;
            
            inputFromOldIdentifier = this.wlc.inputs.find(input => input.identifier.includes(settings.mixId.toUpperCase()));

            if (!inputFromOldIdentifier) {
                // macOS specific
                inputFromOldIdentifier = this.wlc.inputs.find(input => input.identifier.includes(settings.mixId));
            }

            if (inputFromOldIdentifier) {
                delete settings.mixId;
                settings.identifier = inputFromOldIdentifier.identifier;
                this.setSettings(context, settings);
                return settings.identifier;
            }
        } else if (settings.inputIndex) {
            // ...if nothing was saved, check for a saved index and configure dynamic  
            if (this.wlc.inputs.length > settings.inputIndex) {  
                var stepOverInputIndex = 0;

                // Get index of "main" microphone
                if (this.wlc.microphones) {
                    const [firstKey] = this.wlc.microphones.keys();
                    this.wlc.inputs.find((input, index) => { if (input.identifier == firstKey) stepOverInputIndex = index; });
                }

                // First index is not always the microphone (mac)
                if (settings.inputIndex == 0 && this.wlc.microphones) {
                    settings.identifier = this.wlc.inputs[stepOverInputIndex].identifier;
                } else {
                    const inputIndex = settings.inputIndex <= stepOverInputIndex && settings.inputIndex > 0 ? settings.inputIndex - 1 : settings.inputIndex;
                    settings.identifier = this.wlc.inputs[inputIndex].identifier;
                }

                delete settings.inputIndex;
                this.setSettings(context, settings);

                return settings.identifier;
            }
        }

        //console.error("Unknown input identifier")
        return;
    };

    fixName(name, maxlen = 8, suffix = '...') {
        return name ? (name && name.length > maxlen ? name.slice(0, maxlen - 1) + suffix : name) : '';
    };

    fadeVolume(fn, delay) {
        var ms = 100;

        if (delay > 0) {
            setTimeout(() => { 
            this.fadeVolume(fn, delay - ms)
            fn();
            }, ms)   
        }
    }

    setSettings(context, payload) {
        debug("setSettings",context, Events.setSettings, { payload: payload })
		$SD.send(context, Events.setSettings, { payload: payload });
	}

    getBase64FaderSVG(context, options, containsUnicode = false) {
        return containsUnicode ? `data:image/svg+xml;base64,${utoa(this.getSliderSVG(context, options))}` : `data:image/svg+xml;base64,${btoa(this.getSliderSVG(context, options))}`;
    }

    getSliderSVG(context, options) {
        if (!options)
            return;

        const isColored       = options.bgColor != 'transparent';
        const disabledOverlay = options.isDisabled ? `<rect opacity=".5" width="144" height="144" fill="#0E0B1DCC"/>` : '';

        // Orientation
        const horizontal      = `<g ${isColored ? '' : 'mask="url(#knobMask)"'} transform="rotate(90 144 144) ${options.isTop ? 'translate(0,144)' : ''}">`;
        const vertical        = `<g ${isColored ? '' : 'mask="url(#knobMask)"'} transform="${options.isTop ? 'translate(0)' : 'translate(0,-144)'}">`;

        let sliderBody        = '';
        let hasFader          = options.orientation == 3 || options.orientation == 4;

        switch (options.orientation) {
            case 1:
            case 3:
                sliderBody = vertical;
                break;
            case 2:
            case 4:
                sliderBody = horizontal;
                break;
            default:
                return;
        }

        //
        const height         = options.value / 100;
        const radius         = 8;
        const faderWidth     = 244;
        const innerLow       = 32;  // note: element #bar needs a 1px offset to avoid a 'blip' when drawing the fill inside of the fader
        const h              = height * (faderWidth - radius * 2) + innerLow;

        const faderOffset    = hasFader ? radius * 3 : 0;
        const faderPositionX = 72 - faderOffset;

        let gradients        = '';
        let gradientLeft     = '';
        let gradientRight    = '';

        if (hasFader) {

            //
            const levelWidth     = faderWidth;
            const hLeft          = options.levelLeft / 100 * levelWidth;
            const hRight         = options.levelRight / 100 * levelWidth;

            // Left level meter gradient values
            const greenLeft     = options.levelLeft > 75 ? 100 / options.levelLeft * 75 : 100;
            const yellowLeft    = options.levelLeft > 85 ? 100 / options.levelLeft * 85 : 100;
            const orangeLeft    = options.levelLeft > 95 ? 100 / options.levelLeft * 95 : 100;

            // Right level meter gradient values
            const greenRight    = options.levelRight > 75 ? 100 / options.levelRight * 75 : 100;
            const yellowRight   = options.levelRight > 85 ? 100 / options.levelRight * 85 : 100;
            const orangeRight   = options.levelRight > 95 ? 100 / options.levelRight * 95 : 100;

            // Gradient elements definitions
            gradientLeft  = `<linearGradient id="gradientLeft" x1="0" x2="0" y1="0" y2="1"><stop offset="${greenLeft}%" stop-color="#3bb455" /><stop offset="${yellowLeft}%" stop-color="yellow" /><stop offset="${orangeLeft}%" stop-color="orange" /><stop offset="100%" stop-color="red" /></linearGradient>`
            gradientRight = `<linearGradient id="gradientRight" x1="0" x2="0" y1="0" y2="1"><stop offset="${greenRight}%" stop-color="#3bb455" /><stop offset="${yellowRight}%" stop-color="yellow" /><stop offset="${orangeRight}%" stop-color="orange" /><stop offset="100%" stop-color="red" /></linearGradient>`

            gradients           =   `<g id="levelmeters" transform="rotate(180, 72, 133)">
                                        <rect id="bar" x="${radius * 4}" rx="${radius / 2}" width="${radius}" height="${levelWidth}" fill="#747474"></rect>
                                        <rect id="bar" x="${radius * 6}" rx="${radius / 2}" width="${radius}" height="${levelWidth}" fill="#747474"></rect>
                                        <rect id="bar" x="${radius * 4}" rx="${radius / 2}" width="${radius}" height="${hLeft}" fill="url(#gradientLeft)"></rect>
                                        <rect id="bar" x="${radius * 6}" rx="${radius / 2}" width="${radius}" height="${hRight}" fill="url(#gradientRight)"></rect>
                                    </g>`
        }

        return  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="144" height="144" viewBox="0 0 144 144">
                    <defs>
                        <path id="path-3" d="M14,0 C21.7319865,0 28,6.2680135 28,14 L28,230 C28,237.731986 21.7319865,244 14,244 C6.2680135,244 0,237.731986 0,230 L0,14 C0,6.2680135 6.2680135,0 14,0 Z M14,6 C11.790861,6 9.790861,6.8954305 8.34314575,8.34314575 C6.8954305,9.790861 6,11.790861 6,14 L6,230 C6,232.209139 6.8954305,234.209139 8.34314575,235.656854 C9.790861,237.104569 11.790861,238 14,238 C16.209139,238 18.209139,237.104569 19.6568542,235.656854 C21.1045695,234.209139 22,232.209139 22,230 L22,14 C22,11.790861 21.1045695,9.790861 19.6568542,8.34314575 C18.209139,6.8954305 16.209139,6 14,6 Z"/>
                        ${gradientLeft}
                        ${gradientRight}
                    </defs>
                    <mask id="knobMask">
                        <rect id="background" width="288" height="288" fill="white" />
                        <circle id="outerKnobBorderRemoved" cx="${faderPositionX}" cy="${h}" r="22" fill="white" stroke="black" stroke-width="6" />
                        <circle id="innerKnobCircleRemoved" cx="${faderPositionX}" cy="${h}" r="14" fill="black" />
                    </mask>
                    ${sliderBody}
                        <polygon id="background" fill="${options.bgColor}" fill-rule="nonzero" points="-72 72 216 72 216 216 -72 216" transform="rotate(-90 72 144)"/>
                        <g id="back" transform="translate(${58 - faderOffset} 22)">
                            <use xlink:href="#path-3" id="slider" fill="#FFF"/>
                        </g>
                        ${gradients}
                        <rect id="bar" x="${64 - faderOffset}" y="${1 + h}" rx="${radius}" width="${radius*2}" height="${faderWidth - h + radius*2}" fill="#FFF"></rect>
                        ${isColored ? `<circle id="knobCircleBorderColored" cx="${faderPositionX}" cy="${h}" r="26" fill="${options.bgColor}"/>` : ''}
                        <circle id="knobCircle" cx="${faderPositionX}" cy="${h}" r="20" fill="${'white'}" ${isColored ? '' : 'mask="url(#knobMask)"'}/>
                        ${isColored ? `<circle id="knobCircleHoleColored" cx="${faderPositionX}" cy="${h}" r="14" fill="${options.bgColor}"/>` : ''}
                    </g>
                    ${disabledOverlay}
                </svg>`
    }

    getLevelmeterSVG(level = 0, isBottom = false, isLongerBar = false) {
        const green = level > 75 ? 100 / level * 75 : 100;
        const yellow = level > 85 ? 100 / level * 85 : 100;
        const orange = level > 95 ? 100 / level * 95 : 100;

        const levelmeter = 0 + (((102 - 0) / (100 - 0)) * (level - 0));

        const gradient = `<defs><linearGradient id="tmpGradient"><stop offset="${green}%" stop-color="#3bb455" /><stop offset="${yellow}%" stop-color="yellow" /><stop offset="${orange}%" stop-color="orange" /><stop offset="100%" stop-color="red" /></linearGradient></defs>`

        return `data:image/svg+xml;base64,${btoa(`<svg width="${isLongerBar ? 136 : 108}" height="4" viewBox="0 0 106 4">${gradient}<rect height="4" width="${102}" x="2" rx="2" fill="#747474" /><rect height="4" width="${levelmeter}" x="2" rx="2" fill="url(#tmpGradient)" /></svg>`)}`
    }

    checkIfKeyIconUpdateIsNeeded(context, actionStyle, identifier, options, notificationType) {
        var updateNeeded = false;

        if (notificationType != kJSONPropertyOutputLevelChanged && notificationType != kJSONPropertyInputLevelChanged) {
            updateNeeded = true;
        } else if (actionStyle >= 3 && !this.feedbackBlocked.get(identifier)) {
            if (options.isTop) {
                const lastLevelmeterValuesTop = this.lastLevelmeterValues?.get(context + 'top') ? this.lastLevelmeterValues.get(context + 'top') : this.lastLevelmeterValues.set(context + 'top', [0, 0, false]);
                const valueInRangeChanged = options.levelLeft >= 50 || options.levelRight >= 50;
                const additionalUpdateNeeded = lastLevelmeterValuesTop?.[2] ? lastLevelmeterValuesTop?.[0] >= 50 || lastLevelmeterValuesTop?.[1] >= 50 : false; 

                if (valueInRangeChanged) {
                    updateNeeded = true;

                    lastLevelmeterValuesTop[0] = options.levelLeft;
                    lastLevelmeterValuesTop[1] = options.levelRight;
                    lastLevelmeterValuesTop[2] = true;
                } else if (additionalUpdateNeeded) {
                    updateNeeded = true;

                    lastLevelmeterValuesTop[0] = options.levelLeft;
                    lastLevelmeterValuesTop[1] = options.levelRight;
                    lastLevelmeterValuesTop[2] = false;
                }
            } else {
                const lastLevelmeterValuesBottom = this.lastLevelmeterValues?.get(context + 'bottom') ? this.lastLevelmeterValues.get(context + 'bottom') : this.lastLevelmeterValues.set(context + 'bottom', [0, 0, false]);
                const valueInRangeChanged = options.levelLeft <= 50 || options.levelRight <= 50;
                const additionalUpdateNeeded = lastLevelmeterValuesBottom?.[2] ? lastLevelmeterValuesBottom?.[0] <= 50 || lastLevelmeterValuesBottom?.[1] <= 50 : false; 

                if (valueInRangeChanged) {
                    updateNeeded = true;

                    lastLevelmeterValuesBottom[0] = options.levelLeft;
                    lastLevelmeterValuesBottom[1] = options.levelRight;
                    lastLevelmeterValuesBottom[2] = true;
                } else if (additionalUpdateNeeded) {
                    updateNeeded = true;

                    lastLevelmeterValuesBottom[0] = options.levelLeft;
                    lastLevelmeterValuesBottom[1] = options.levelRight;
                    lastLevelmeterValuesBottom[2] = false;
                }
            }
        }

        return updateNeeded;
	}
}