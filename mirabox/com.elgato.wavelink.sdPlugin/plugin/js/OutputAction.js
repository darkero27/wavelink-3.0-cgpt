/// <reference path="WaveLinkAction.js" />

class OutputAction extends WaveLinkAction {

    feedbackBlocked = new Map();

    constructor(uuid) { 

        super(uuid);

        this.onKeyDown(async ({ context, payload }) => {
            const { settings } = payload;

            try {
                switch (settings.actionType) {
                    case ActionType.SetVolume:
                        //if (settings.mixerID == kPropertyMixerIDAll)
                        //    throw `${settings.mixerID} is not available on ${ActionType.SetVolume}`;
                    
                        const output = this.wlc.output;
                        const isNotBlocked = settings.mixerID == kPropertyMixerIDLocal ? output.isNotBlockedLocal : output.isNotBlockedStream;
                                
                        if (isNotBlocked) {
                            this.wlc.setOutputConfig(context, kPropertyOutputLevel, false, settings.mixerID, settings.volValue, settings.fadingDelay);
                            
                            if (settings.fadingDelay > 0) {
                                setTimeout(() => { $SD.showOk(context); }, settings.fadingDelay + 50) 
                            } 
                        }
                        break;
                    case ActionType.AdjustVolume:
                        //if (settings.mixerID == kPropertyMixerIDAll)
                        //    throw `${settings.mixerID} is not available on ${ActionType.AdjustVolume}`;

                        this.adjustVolume(context, kPropertyOutputLevel, true, settings.mixerID, settings.volValue);
                        break;
                }
            
            } catch (error) {
                $SD.showAlert(context);
                console.error(error);
            } 
        });

        this.onKeyUp(async ({ context, payload }) => {
            const { settings } = payload;
            const { isInMultiAction } = payload;

            try {
                switch (settings.actionType) {
                    case ActionType.Mute:
                        const output = this.wlc.getOutput();
                        const newValue = isInMultiAction ? !payload.userDesiredState : settings.mixerID == kPropertyMixerIDLocal ? !output.local.isMuted : !output.stream.isMuted;

                        if (output == undefined)
                            throw 'No output found';

                        this.wlc.setOutputConfig(context, kPropertyOutputMute, false, settings.mixerID, newValue);
                        break;
                    case ActionType.SwitchOutput:
                        this.wlc.changeSwitchState();
                        break;

                    default:
                        if (this.keyTimer.get(context)) {
                            clearTimeout(this.keyTimer.get(context));
                            this.keyTimer.delete(context);
                        }
                        break;
                }
            } catch (error) {
                $SD.showAlert(context);
                console.error(error);
            }

            this.setState(context);
        });

        this.onDialRotate(({ context, payload }) => {
            const { settings } = payload;
            const { ticks } = payload;

            try {
                const newValue = ticks * settings.volValue;
                this.wlc.setOutputConfig(context, kPropertyOutputLevel, true, settings.mixerID, newValue == undefined ? 1 : newValue);

                if (this.feedbackBlocked.get(settings.mixerID)) {
                    clearTimeout(this.feedbackBlocked.get(settings.mixerID));
                    this.feedbackBlocked.delete(settings.mixerID);
                    this.feedbackBlocked.set(settings.mixerID, setTimeout(() => { this.feedbackBlocked.delete(settings.mixerID); }, 100));
                } else {
                    this.feedbackBlocked.set(settings.mixerID, setTimeout(() => { this.feedbackBlocked.delete(settings.mixerID); }, 100));
                }

                if (this.feedbackBlocked.get(context)) {
                    clearTimeout(this.feedbackBlocked.get(context));
                    this.feedbackBlocked.delete(context);

                    this.feedbackBlocked.set(context, setTimeout(() => { this.feedbackBlocked.delete(context); this.setFeedbackLayout(context, settings.actionStyle); this.setFeedback(context); }, 2000));
                } else {
                    this.feedbackBlocked.set(context, setTimeout(() => { this.feedbackBlocked.delete(context); this.setFeedbackLayout(context, settings.actionStyle); this.setFeedback(context); }, 2000));

                    this.setFeedbackLayout(context, settings.actionStyle);
                    this.setFeedback(context);
                }

                this.throttleUpdate(context, 100, () => { this.setFeedbackVolume(context); });
            } catch (error) {
                $SD.showAlert(context);
                console.error(error);
            }
        });

        this.onDialUp(({ context, payload }) => {
            const { pressed } = payload;

            if (pressed)
                return;
            
            const { settings } = payload;
            try {                
                const output = this.wlc.getOutput();
                const newValue = settings.mixerID == kPropertyMixerIDLocal ? !output.local.isMuted : !output.stream.isMuted;

                if (output == undefined)
                    throw 'No output found';
                
                this.wlc.setOutputConfig(context, kPropertyOutputMute, false, settings.mixerID, newValue);
            } catch (error) {
                $SD.showAlert(context);
                console.error(error);
            }
        });

        this.onTouchTap(({ context, payload }) => {
            const { settings } = payload;

            try {
                const output = this.wlc.getOutput();

                if (output == undefined)
                    throw 'No output found';

                const newValue = settings.mixerID == kPropertyMixerIDLocal ? !output.local.isMuted : !output.stream.isMuted;

                this.wlc.setOutputConfig(context, kPropertyOutputMute, false, settings.mixerID, newValue);
            } catch (error) {
                $SD.showAlert(context);
                console.error(error);
            }
        });

        this.wlc.onEvent(kPropertyOutputChanged, () => {
            this.actions.forEach((action, context) => {
                if (action.isEncoder) {
                    this.setFeedback(context);
                    this.setKeyIcons(context);
                } else {
                    this.setKeyIcons(context);
                    this.setState(context);
                    this.setTitle(context);
                }
            });
        });

        this.wlc.onEvent(kJSONPropertyOutputMuteChanged, (payload) => {
            this.actions.forEach((action, context) => {
                if (action.isEncoder) {
                    this.setFeedback(context, true);
                    this.setKeyIcons(context);
                } else {
                    this.setState(context);
                }
            });
        });

        this.wlc.onEvent(kJSONPropertyOutputVolumeChanged, (payload) => {
            this.actions.forEach((action, actionContext) => {
                const { settings } = action;
                const { context } = payload;
                const { updateAll } = payload;

                if (actionContext != context && updateAll) {
                    if (action.isEncoder) {
                        this.setFeedback(actionContext);
                    } else if (settings.actionType == ActionType.Mute) {
                        this.setKeyIcons(actionContext);
                    } else if (settings.actionType == ActionType.AdjustVolume) {
                        this.setKeyIcons(actionContext);
                    }
                } else if (settings.actionType == ActionType.AdjustVolume) {
                    this.setKeyIcons(actionContext);
                }
            });
        });

        this.wlc.onEvent(kJSONPropertyOutputLevelChanged, () => {
            this.actions.forEach((action, actionContext) => {
                const { settings } = action;

                if (this.useLevelmeter(actionContext, settings.actionStyle, settings.mixerID)) {
                    if (action.isEncoder) {
                        this.setFeedback(actionContext);
                    } else if (settings.actionType == ActionType.AdjustVolume && !this.feedbackBlocked.get(settings.mixerID) || true) {
                        this.setKeyIcons(actionContext, kJSONPropertyOutputLevelChanged);
                    }
                }
            });
        });

        this.wlc.onEvent(kJSONPropertyOutputSwitched, () => {
            this.actions.forEach((action, context) => {
                if (!action.isEncoder) {
                    this.setState(context);
                }
            });
        });

    }

    setKeyIcons(context, notificationType = undefined) {
        const settings   = this.actions.get(context).settings;
        const isEncoder  = this.actions.get(context).isEncoder;
        const output     = this.wlc.getOutput();
        const actionType = settings.actionType;

        if (!isEncoder && actionType == ActionType.AdjustVolume && settings.actionStyle != 0) {
            const options = {
                bgColor: 'transparent',
                value: 0 + 100,
                levelLeft: 0,
                levelRight : 0,
                isTop: settings.volValue >= 0 ? true : false,
                orientation: settings.actionStyle,
                isDisabled: true
            }

            if (output != undefined) {
                options.value      = settings.mixerID == kPropertyMixerIDLocal ? -output.local.volume + 100 : -output.stream.volume + 100;
                options.levelLeft  = settings.mixerID == kPropertyMixerIDLocal ? output?.local.levelLeft : output?.stream.levelLeft;
                options.levelRight = settings.mixerID == kPropertyMixerIDLocal ? output?.local.levelRight : output?.stream.levelRight;
                options.isDisabled = !this.isAppStateOk();
            }

            if (options.value == undefined || options.value == NaN) {
                console.error("No valid property value");
                return;
            }

            switch (settings.actionStyle) {
                case 1:
                case 2:
                    $SD.setImage(context, this.getBase64FaderSVG(context, options));
                    break;
                case 3:
                case 4:
                    if (output == undefined) {
                        $SD.setImage(context, this.getBase64FaderSVG(context, options));
                    } else if (this.checkIfKeyIconUpdateIsNeeded(context, settings.actionStyle, settings.identifier, options, notificationType)) {
                        this.throttleUpdate(context, 50, () => {
                            options.levelLeft  = settings.mixerID == kPropertyMixerIDLocal ? output?.local.levelLeft : output?.stream.levelLeft;
                            options.levelRight = settings.mixerID == kPropertyMixerIDLocal ? output?.local.levelRight : output?.stream.levelRight;

                            $SD.setImage(context, this.getBase64FaderSVG(context, options));
                        });
                    }
                    break;
                default:
                    break;
            }
		} else {
			const images = this.getKeyIcon(context);

			var imgUnmuted = images[0];
			var imgMuted = images[1];

			if (typeof(imgUnmuted) == "object") {
				imgUnmuted = images[0].toBase64(true);
				imgMuted = images[1].toBase64(true);
			}

			if (isEncoder) {
				const muteState = output != undefined ? settings.mixerID == 'all' ? output.stream.isMuted : (settings.mixerID == kPropertyMixerIDLocal ? output.local.isMuted : output.stream.isMuted) : 0;
				$SD.setImage(context, muteState ? imgMuted : imgUnmuted, 0);
			} else if (settings.actionType == ActionType.Mute || settings.actionType == ActionType.SwitchOutput) {
				$SD.setImage(context, imgUnmuted, 0);
				$SD.setImage(context, imgMuted, 1);
			} else {
				$SD.setImage(context, imgUnmuted, 0);
				$SD.setImage(context, imgUnmuted, 1);
			}
		}
    }

    setState(context) {
        const settings = this.actions.get(context).settings;

        switch (settings.actionType) {
            case ActionType.Mute:
                const output = this.wlc.getOutput();

                if (output) {
                    const muteState = settings.mixerID == kPropertyMixerIDLocal ? output.local.isMuted : output.stream.isMuted;
                    $SD.setState(context, ~~muteState);
                }
                break;
            case ActionType.SwitchOutput:
                if (this.wlc.switchState) {
                    const switchState = this.wlc.switchState == kPropertyMixerIDLocal ? 0 : 1;
                    $SD.setState(context, switchState);
                }
                break;
            default:
                $SD.setState(context, 0);
                break;
        }
    }

    setFeedback(context) {
        const settings     = this.actions.get(context).settings;
        const output       = this.wlc.getOutput();
        const isDisabled   = !this.wlc.isConnected || !this.wlc.isUpToDate;

        const mixer        = settings.mixerID == kPropertyMixerIDAll ? 'All' : settings.mixerID == kPropertyMixerIDLocal ? 'Monitor' : 'Stream';
        const muteState    = settings.mixerID == 'all' ? output?.stream.isMuted : (settings.mixerID == kPropertyMixerIDLocal ? output?.local.isMuted : output?.stream.isMuted);
        const muteIcon     = muteState ? 'Mute' : '';

        const percentSign  = this.wlc.localization?.['Actions']?.['Common'] || '';

        const localVolume  = output?.local.volume != undefined ? output?.local.volume : '--' ;
        const streamVolume = output?.stream.volume != undefined ? output?.stream.volume : '--';
        const volume       = settings.mixerID == kPropertyMixerIDLocal ? localVolume : streamVolume;

        const titleVolume  =`${percentSign?.percentFirst || ''}${volume} ${percentSign?.percentLast || ''}`;

        const payload      = {};

        payload.title = {
            value: `Master Output`
        }

        if (settings.mixerID == kPropertyMixerIDAll) {
            const monitorMuteState = output?.local.isMuted ? 'Mute' : '';
            const streamMuteState = output?.stream.isMuted ? 'Mute' : '';

            const monitorIcon = `outputMonitor${monitorMuteState}`;
            const streamIcon = `outputStream${streamMuteState}`;

            payload.icon1 = {
                value: this.awl.touchIconsOutput[monitorIcon],
                opacity: isDisabled ? 0.5 : 1
            }

            payload.icon2 = {
                value: this.awl.touchIconsOutput[streamIcon],
                opacity: isDisabled ? 0.5 : 1
            }

            if (this.useLevelmeter(context, settings.actionStyle, settings.mixerID)) {
                payload.levelmeterTop1 = { 
                    value: this.getLevelmeterSVG(output?.local.levelLeft, false, true),
                    opacity: isDisabled ? 0 : 1
                }

                payload.levelmeterBottom1 = { 
                    value: this.getLevelmeterSVG(output?.local.levelRight, true, true),
                    opacity: isDisabled ? 0 : 1
                }

                payload.levelmeterTop2 = { 
                    value: this.getLevelmeterSVG(output?.stream.levelLeft, false, true),
                    opacity: isDisabled ? 0 : 1
                }

                payload.levelmeterBottom2 = { 
                    value: this.getLevelmeterSVG(output?.stream.levelRight, true, true),
                    opacity: isDisabled ? 0 : 1
                }
            } else {
                payload.indicator1 = {
                    value: localVolume || 0,
                    opacity: isDisabled ? 0 : 1
                }

                payload.indicator2 = {
                    value: streamVolume || 0,
                    opacity: isDisabled ? 0 : 1
                }
            }
        } else {
            const variableIcon = `output${mixer}${muteIcon}`;

            payload.icon = {
                value: this.awl.touchIconsOutput[variableIcon],
                opacity: isDisabled ? 0.5 : 1
            }

            payload.value = {
                value: isDisabled ? '--' : titleVolume,
                opacity: isDisabled ? 0.5 : 1
            }

            if (this.useLevelmeter(context, settings.actionStyle, settings.mixerID)) {
                const levelLeft = settings.mixerID == kPropertyMixerIDLocal ? output?.local.levelLeft : output?.stream.levelLeft;
                const levelRight = settings.mixerID == kPropertyMixerIDLocal ? output?.local.levelRight : output?.stream.levelRight;

                payload.levelmeterTop = { 
                    value: this.getLevelmeterSVG(levelLeft),
                    opacity: isDisabled ? 0 : 1
                }

                payload.levelmeterBottom = { 
                    value: this.getLevelmeterSVG(levelRight, true),
                    opacity: isDisabled ? 0 : 1
                }
            } else {
                payload.indicator = {
                    value: volume || 0,
                    opacity: isDisabled ? 0 : 1
                }
            }
        }

        $SD.send(context, "setFeedback", { payload });
    }

    setFeedbackVolume(context) {
        this.setFeedback(context);
    }

    getKeyIcon(context) {
        const settings   = this.actions.get(context).settings;
        const isEncoder  = this.actions.get(context).isEncoder;
        const output     = this.wlc.getOutput();
        const actionType = settings.actionType;

        const isDisabled = !this.isAppStateOk();

        const mixer      = settings.mixerID == kPropertyMixerIDAll ? 'All' : settings.mixerID == kPropertyMixerIDLocal ? 'Monitor' : 'Stream';
        const muteState  = output != undefined ? settings.mixerID == 'all' ? output.stream.isMuted : (settings.mixerID == kPropertyMixerIDLocal ? output.local.isMuted : output.stream.isMuted) : 0;

        var icon, icon2;
        
        switch (actionType) {
            case ActionType.Mute:
                icon = `output${mixer}`;
                icon2 = `output${mixer}Mute`;
                break;
            case ActionType.AdjustVolume:
                if (settings.actionStyle == 0 && !isEncoder)
                    icon = settings.volValue < 0 ? 'decrease' : 'increase';
                else
                    icon = `output${mixer}${muteState ? 'Mute' : ''}`;
                break;
            case ActionType.SetVolume:
                icon = icon2 = `outputSet`;
                break;
            case ActionType.SwitchOutput:
                icon = 'toggleOutputMonitor';
                icon2 = 'toggleOutputStream';
                break;
            default:
                icon = 'default';
                break;
        }

        if (!icon2)
            icon2 = icon;

        const svgIcon = this.awl.keyIconsOutput[icon];
        const svgIcon2 = this.awl.keyIconsOutput[icon2];

        const disabledOverlay = isDisabled ? 'disabled' : '';

        if (settings.actionType == ActionType.Mute) {
            const percentSign  = this.wlc.localization['Actions']?.['Common'] || '';
            const localVolume  = output?.local.volume != undefined ? output?.local.volume : '--' ;
            const streamVolume = output?.stream.volume != undefined ? output?.stream.volume : '--';
            const volume       = settings.mixerID == kPropertyMixerIDLocal ? localVolume : streamVolume;
            const volumeText   = settings.mixerID == kPropertyMixerIDAll ? (`${localVolume} | ${streamVolume}`) : (`${percentSign?.percentFirst || ''}${volume} ${percentSign?.percentLast || ''}`);

            //const muteState = settings.mixerID == 'all' ? output.stream.isMuted : (settings.mixerID == kPropertyMixerIDLocal ? output.local.isMuted : output.stream.isMuted);

            svgIcon.layerOrder = ['background', 'icon', 'text', disabledOverlay];
            svgIcon.fontSize   = { lower: 26 };

            //svgIcon.fontColor = muteState ? '#E12A40' : 'white';

            svgIcon.text = volume != undefined ? { lower: `${volumeText}` } : '';
            svgIcon2.layerOrder = ['background', 'icon', 'muteOverlay', 'text', disabledOverlay];

            //svgIcon2.fontColor = muteState ? '#E12A40' : 'white';

            svgIcon2.fontSize = { lower: 26 };
            svgIcon2.text     = volume != undefined ? { lower: `${volumeText}` } : '';
        } else {
            svgIcon.layerOrder  = ['background', 'icon', disabledOverlay];
        }

        return [svgIcon, svgIcon2];
    }

    adjustVolume(context, property, methodType, mixerID, value) {
		const settings = this.actions.get(context).settings;

        this.wlc.setOutputConfig(context, property, methodType, mixerID, value);

        if (this.feedbackBlocked.get(settings.mixerID)) {
            clearTimeout(this.feedbackBlocked.get(settings.mixerID));
            this.feedbackBlocked.delete(settings.mixerID);

            this.feedbackBlocked.set(settings.mixerID, setTimeout(() => { this.feedbackBlocked.delete(settings.mixerID); }, 100));
        } else {
            this.feedbackBlocked.set(settings.mixerID, setTimeout(() => { this.feedbackBlocked.delete(settings.mixerID); }, 100));

            this.setKeyIcons(context);
            this.wlc.emitEvent(kJSONPropertyOutputVolumeChanged, { context, mixerID });
        }

        this.keyTimer.set(context, setTimeout(() => this.adjustVolume(context, property, methodType, mixerID, value), 200));
    }
};