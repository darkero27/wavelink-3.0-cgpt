/// <reference path="WaveLinkAction.js" />

class HardwareAction extends WaveLinkAction {

    feedbackBlocked = new Map();
    errorOnKeyDown = false;

    constructor(uuid) {
        super(uuid);
        
        this.onKeyDown(({ context, payload }) => {
            const { settings } = payload;

            try {
                switch (settings.actionType) {
                    case ActionType.SetOutput:
                            if (this.checkForValidExecutionConditions(settings)) {
                                if (settings.primOutput != this.wlc.selectedLocalOutput && settings.primOutput != this.wlc.selectedStreamOutput)
                                    this.wlc.setSelectedOutput(settings.primOutput, settings.mixerID);
                            } else {
                                throw 'Action not fully configured.';
                            }
                        break;
					case ActionType.SetDeviceSettings:
						if (!this.isSupportedByDevice(settings.micSettingsAction, this.wlc.getMicrophone().deviceType))
							throw 'Not supported by this device';

						switch (settings.micSettingsAction) {
							case kPropertySetGain:
								this.wlc.setMicrophoneConfig(context, kJSONPropertyGain, settings.volValue);
								break;
							case kPropertyAdjustGain:
								this.adjustValue(context, kJSONPropertyGain, settings.volValue);
								break;
							case kPropertytoggleGainLock:
								this.wlc.setMicrophoneConfig(context, kPropertyMicrophoneGainLock, settings.volValue);
								break;
							case kPropertySetOutput:
								this.wlc.setMicrophoneConfig(context, kJSONPropertyOutputVolume, settings.volValue);
								break;
							case kPropertyAdjustOutput:
								this.adjustValue(context, kJSONPropertyOutputVolume, settings.volValue);
								break;
							case kPropertySetOutput:
								this.wlc.setMicrophoneConfig(context, kJSONPropertyOutputVolume, settings.volValue);
								break;
							case kPropertySetMicPcBalance:
								this.wlc.setMicrophoneConfig(context, kJSONPropertyBalance, settings.volValue);
								break; 
							case kPropertyAdjustMicPcBalance:
								this.adjustValue(context, kJSONPropertyBalance, settings.volValue);
								break;
							default:
								break;
						}
						break;
					default:
						break;
				}
			} catch (error) {
				this.errorOnKeyDown = true;
				console.error(error);
				$SD.showAlert(context);
			}
		});

        this.onKeyUp(({ context, payload }) => {
            const { settings } = payload;

            try {
                if (this.errorOnKeyDown)
                    throw 'Error on key down';

                switch (settings.actionType) {
                    case ActionType.ToggleOutput:
                        if (this.checkForValidExecutionConditions(settings)) {
                            const selectedOutput = this.wlc.isAPIVersionOlderAs(7) || settings.mixerID == kPropertyMixerIDLocal ? this.wlc.selectedLocalOutput : this.wlc.selectedStreamOutput;

                            if (selectedOutput != settings.primOutput)
                                this.wlc.setSelectedOutput(settings.primOutput, settings.mixerID);
                            else if (selectedOutput != settings.secOutput)
                                this.wlc.setSelectedOutput(settings.secOutput, settings.mixerID);
                        } else {
                            throw 'Action not fully configured.';
                        }
                        break;
					case ActionType.SetDeviceSettings:
						const microphone = this.wlc.getMicrophone();

						if (!this.isSupportedByDevice(settings.micSettingsAction, microphone.deviceType))
							throw 'Not supported by this device';

						switch (settings.micSettingsAction) {
							case kPropertyToggleLowcut:
								const isWaveXLR         = microphone?.deviceType == DeviceType.WaveXLR;
								const newLowcutState    = isWaveXLR ? this.getNextLowcutType() : !microphone?.isLowCutOn;
								const property          = isWaveXLR ? kPropertyMicrophoneLowCutType : kPropertyMicrophoneLowCut;

								this.wlc.setMicrophoneConfig(context, property, newLowcutState);
								break;
							case kPropertyToggleClipguard:
								this.wlc.setMicrophoneConfig(context, kPropertyMicrophoneClipGuard, !microphone?.isClipGuardOn);
								break;
							case kPropertyToggleHardwareMute:
								this.muteHardware(context, payload);
								break;
							default:
								if (this.keyTimer.get(context)) {
									clearTimeout(this.keyTimer.get(context));
									this.keyTimer.delete(context);
								}
								break;
						}
						break;
					default:
						break;
				}

				this.setState(context);
			} catch (error) {
				this.setState(context);
                console.error(error);
				$SD.showAlert(context);
				this.errorOnKeyDown = false;
			}
		});

		this.onDialRotate(({ context, payload }) => {
			const { settings } = payload;
			const { ticks } = payload;

			const deviceSetting = settings.micSettingsAction;
			const microphone = this.wlc.getMicrophone();

			try {
				if (!this.isSupportedByDevice(settings, microphone.deviceType))
					throw 'Not supported by this device';

				var property, currentValue;

				switch (deviceSetting) {
					case kPropertyAdjustGain:
						property = kJSONPropertyGain;
						currentValue = microphone.gainIndex;
						break;
					case kPropertyAdjustOutput:
						property = kJSONPropertyOutputVolume;
						currentValue = microphone.outputVolumeIndex;
						break;
					case kPropertyAdjustMicPcBalance:
						property = kJSONPropertyBalance;
						currentValue = microphone.balanceIndex;
						break;
					default:
						break;
				}

				if (property) {
					const newValue = ticks * settings.volValue + currentValue;
					this.wlc.setMicrophoneConfig(context, property, newValue == undefined ? 1 : newValue);

					if (this.feedbackBlocked.get(deviceSetting)) {
						clearTimeout(this.feedbackBlocked.get(deviceSetting));
						this.feedbackBlocked.delete(deviceSetting);
						this.feedbackBlocked.set(deviceSetting, setTimeout(() => { this.feedbackBlocked.delete(deviceSetting); }, 100));
					} else {
						this.feedbackBlocked.set(deviceSetting, setTimeout(() => { this.feedbackBlocked.delete(deviceSetting); }, 100));
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

					this.throttleUpdate(context, 100, () => this.setFeedbackVolume(context));
				}
			} catch (error) {
				$SD.showAlert(context);
				console.error(error);
			}
		});

		this.onDialUp(({ context, payload }) => {
			const { pressed } = payload;

			if (!pressed)
				this.muteHardware(context);
		});

		this.onTouchTap(({ context }) => {
			this.muteHardware(context);
		});

		this.wlc.onEvent(kJSONPropertyInputsChanged, () => {
			this.actions.forEach((action, actionContext) => {
				if (action.isEncoder) {
					this.setFeedback(actionContext);
					this.setKeyIcons(actionContext);
				} else {
					this.setKeyIcons(actionContext);
					this.setState(actionContext);
					this.setTitle(actionContext);
				}
			});
		});

		this.wlc.onEvent(kJSONPropertyMicrophoneLevelChanged, () => {
			this.actions.forEach((action, actionContext) => {
				const { settings } = action;

				if (this.useLevelmeter(actionContext, settings.actionStyle, settings.micSettingsAction) && settings.micSettingsAction == kPropertyAdjustGain) {
					if (action.isEncoder)
						this.setFeedback(actionContext);
					else if (!this.feedbackBlocked.get(kJSONPropertyGain)) {
						this.setKeyIcons(actionContext, kJSONPropertyInputLevelChanged);
					}
				}
			});
		});

        this.wlc.onEvent(kJSONPropertySelectedOutputChanged, () => {
            this.actions.forEach((action, actionContext) => {
                if (action.isEncoder) {
                    this.setFeedback(actionContext);
                } else {
                    this.setState(actionContext);
                }
                this.setKeyIcons(actionContext);
            });
        });

		this.wlc.onEvent(kJSONPropertyOutputLevelChanged, (payload) => {
			this.actions.forEach((action, actionContext) => {
				const { settings } = action;

				if (this.useLevelmeter(actionContext, settings.actionStyle, settings.micSettingsAction) && settings.micSettingsAction == kPropertyAdjustOutput) {
					if (action.isEncoder)
						this.setFeedback(actionContext);
					else if (!this.feedbackBlocked.get(kJSONPropertyOutputVolume)) {
						this.setKeyIcons(actionContext, kJSONPropertyOutputLevelChanged);
					}
				}
			});
		});

        this.wlc.onEvent(kJSONPropertyMicrophoneConfigChanged, (payload) => {
            this.actions.forEach((action, actionContext) => {
                const settings = action.settings;
                const { property } = payload;
                const { context } = payload;

                if (actionContext != context || property == kPropertyMicrophoneMute) {
                    if (action.isEncoder && this.isActionUpdateNeeded(property, settings.micSettingsAction)) {
                        if (property == kPropertyMicrophoneMute)
                            this.setFeedback(actionContext);
                        else
                            this.setFeedbackVolume(actionContext);
                    } else if (this.isActionUpdateNeeded(property, settings.micSettingsAction)) {
                        if (this.isAdjustAction(settings.micSettingsAction))
                            this.setKeyIcons(actionContext);
                        else
                            this.setState(actionContext);
                    }
                }
            });
        });
    };

    setKeyIcons(context, notificationType = undefined) {
        const settings      = this.actions.get(context).settings;
        const isEncoder     = this.actions.get(context).isEncoder;
        const deviceSetting = settings.micSettingsAction;
        const isDisabled    = !this.isAppStateOk() || !this.checkForValidExecutionConditions(settings);

        if (!isEncoder && this.isAdjustAction(deviceSetting) && settings.actionStyle != 0) {
            const microphone = this.wlc.getMicrophone();

            var indicatorValue = 0, levelLeft = 0, levelRight = 0;

            if (microphone != undefined) {
                switch (deviceSetting) {
                    case kPropertyAdjustGain:
                        levelLeft = microphone?.levelLeft || 0;
                        levelRight = microphone?.levelRight || 0;

                        indicatorValue = this.wlc.getValueConverter(deviceSetting).getFirstValueFromIndex(microphone.gainIndex) * 100;
                        break;
                    case kPropertyAdjustOutput:
                        const output = this.wlc.getOutput();

                        levelLeft = this.wlc.switchState == kPropertyMixerIDLocal ? output?.local.levelLeft : output?.stream.levelLeft;
                        levelRight = this.wlc.switchState == kPropertyMixerIDLocal ? output?.local.levelRight : output?.stream.levelRight;

                        indicatorValue = this.wlc.getValueConverter(deviceSetting).getFirstValueFromIndex(microphone.outputVolumeIndex) * 100;
                        break;
                    case kPropertyAdjustMicPcBalance:
                        indicatorValue = microphone.balanceIndex;
                        break;
                    default:
                        return;
                }
            }

            const options = {
                bgColor: 'transparent',
                value: parseInt(100 - indicatorValue),
                levelLeft: levelLeft,
                levelRight : levelRight,
                isTop: settings.volValue >= 0 ? true : false,
                orientation: settings.actionStyle
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
                    if (this.checkIfKeyIconUpdateIsNeeded(context, settings.actionStyle, deviceSetting, options, notificationType)) {
                        this.throttleUpdate(context, 50, () => {
                            switch (deviceSetting) {
                                case kPropertyAdjustGain:
                                    //const [firstKey] = this.wlc.microphones.keys();
                                    //const input = this.wlc.inputs.find((input, index) => input.identifier.includes(firstKey));
                                    options.levelLeft = this.wlc.getMicrophone()?.levelLeft || 0;
                                    options.levelRight = this.wlc.getMicrophone()?.levelRight || 0;
                                    break;
                                case kPropertyAdjustOutput:
                                    const output = this.wlc.getOutput();
        
                                    options.levelLeft = this.wlc.switchState == kPropertyMixerIDLocal ? output?.local?.levelLeft : output?.stream?.levelLeft;
                                    options.levelRight = this.wlc.switchState == kPropertyMixerIDLocal ? output?.local?.levelRight : output?.stream?.levelRight;
                                    break;
                                default:
                                    return;
                            }
                            $SD.setImage(context, this.getBase64FaderSVG(context, options));
                        });
                    }
                    break;
                default:
                    break;
                }
        } else {
            var icon  = 'default';
            var icon2 = icon;

            switch (settings.actionType) {
                case ActionType.SetOutput: {
                    icon  = 'setOutputDevice';
                    icon2 = 'setOutputDeviceActive';
                } break;
                case ActionType.ToggleOutput: {
                    icon  = 'toggleOutputDeviceFirst';
                    icon2 = 'toggleOutputDeviceSecond';
                } break;
                case ActionType.SetDeviceSettings:
                    switch (deviceSetting) {
                        case kPropertySetGain:
                        case kPropertySetOutput:
                        case kPropertySetMicPcBalance:
                            icon = icon2 = deviceSetting;
                            break;
                        case kPropertyAdjustGain:
                        case kPropertyAdjustOutput:
                        case kPropertyAdjustMicPcBalance:
                            if (isEncoder)
                                icon = icon2 = deviceSetting + (this.wlc.getMicrophone()?.isMicMuted ? kPropertySuffixMuted : '');
                            else
                                icon = icon2 = (settings.volValue > 0) ? deviceSetting + kPropertySuffixPlus : deviceSetting + kPropertySuffixMinus;
                            break;
                        case kPropertytoggleGainLock:
                        case kPropertyToggleLowcut:
                        case kPropertyToggleClipguard:
                        case kPropertyToggleHardwareMute:
                            icon = deviceSetting + kPropertySuffixOn;
                            icon2 = deviceSetting + kPropertySuffixOff;
                            break;
                        default:
                            break;
                    }
                    break;
                default:
                    break;
            }

            if (!icon2)
                icon2 = icon;

            const svgIcon         = this.awl.keyIconsHardware[icon];
            const svgIcon2        = this.awl.keyIconsHardware[icon2];
            const disabledOverlay = isDisabled ? 'disabled' : '';

            if (settings.actionType == ActionType.SetOutput) {
                let outputName = '';

                if (this.actions.get(context).title == '') {
                    const outputs = settings.mixerID == kPropertyMixerIDLocal ? this.wlc.localOutputs : this.wlc.streamOutputs;
                    outputName    = outputs?.find(output => output.identifier == settings.primOutput)?.name;
                }
                svgIcon.fontSize    = { lower: 26 };
                svgIcon2.fontSize   = { lower: 26 };

                svgIcon.text        = isDisabled ? { lower: '--' } : { lower: `${this.fixName(outputName, 8)}` };
                svgIcon2.text       = isDisabled ? { lower: '--' } : { lower: `${this.fixName(outputName, 8)}` };

                svgIcon.layerOrder  = ['icon', 'text', disabledOverlay];
                svgIcon2.layerOrder = ['icon', 'text', disabledOverlay];
            } else if (settings.actionType == ActionType.SetDeviceSettings && settings.micSettingsAction == kPropertyToggleHardwareMute) {
                svgIcon.layerOrder  = ['icon', disabledOverlay];
                svgIcon2.layerOrder = ['muteOverlay', 'icon', disabledOverlay];
            } else {
                svgIcon.layerOrder  = ['icon', disabledOverlay];
                svgIcon2.layerOrder = ['icon', disabledOverlay];
            }

            if (icon != icon2) {
                $SD.setImage(context, svgIcon.toBase64(true), 0);
                $SD.setImage(context, svgIcon2.toBase64(true), 1);
            } else {
                $SD.setImage(context, svgIcon.toBase64(true));
            }
            return;
        }
    }

    setFeedbackVolume(context) {
        const payload = this.createFeedbackPayload(context, false, false, true, true);
        $SD.send(context, "setFeedback", { payload });
    }

    setFeedback(context) {
        const payload = this.createFeedbackPayload(context, true, true, true, true);
        $SD.send(context, "setFeedback", { payload });
    }

    setFeedbackLayout(context, actionStyle) {
        const payload      = { layout: '$B1' };
        const { settings } = this.actions.get(context);

		switch (settings?.micSettingsAction) {
			case kPropertyAdjustGain:
			case kPropertyAdjustOutput:
				payload.layout = this.useLevelmeter(context, actionStyle, context) ? 'plugin/js/layouts/levelmeterSplitted.json' : '$B1';
				break;
			case kPropertyAdjustMicPcBalance:
				payload.layout = 'plugin/js/layouts/micPcBalance.json';
				break;
			default:
				break;
		}

		$SD.send(context, "setFeedbackLayout", { payload });
	}

    setState(context) {
        const settings = this.actions.get(context).settings;

        switch (settings.actionType) {
            case ActionType.SetOutput: {
                const selectedOutput = settings.mixerID == kPropertyMixerIDLocal ? this.wlc.selectedLocalOutput : this.wlc.selectedStreamOutput;

                $SD.setState(context, ~~(selectedOutput == settings.primOutput));
            } break;
            case ActionType.ToggleOutput: {
                let selectedOutput = settings.mixerID == kPropertyMixerIDLocal ? this.wlc.selectedLocalOutput : this.wlc.selectedStreamOutput;

                if (selectedOutput == settings.primOutput)
                    $SD.setState(context, 0);
                else if (selectedOutput == settings.secOutput)
                    $SD.setState(context, 1);

            } break;
            case ActionType.SetDeviceSettings:
                const microphone = this.wlc.getMicrophone();

                if (microphone == undefined)
                    return;

                var state;

                switch (settings.micSettingsAction) {
                    case kPropertytoggleGainLock:
                        state = ~~!microphone.isGainLocked;
                        break;
                    case kPropertyToggleLowcut:
                        if (microphone.deviceType == DeviceType.WaveXLR)
                            state = microphone.lowCutType > 0 ? 0 : 1;
                        else
                            state = microphone.isLowCutOn ? 0 : 1;
                        break;
                    case kPropertyToggleClipguard:
                        state = ~~!microphone.isClipGuardOn;
                        break;
                    case kPropertyToggleHardwareMute:
                        state = ~~microphone.isMicMuted;
                        break;
                    default:
						state = 0;
                        break;
                }
                $SD.setState(context, state);
                break;
            default:
                break;
        }
    }

    adjustValue(context, property, value) {
        const settings = this.actions.get(context).settings;

        var currentValue = 0;

        switch (property) {
            case kJSONPropertyGain:
                currentValue = this.wlc.getMicrophone()?.gainIndex;
                break;
            case kJSONPropertyOutputVolume:
                currentValue = this.wlc.getMicrophone()?.outputVolumeIndex;
                break;
            case kJSONPropertyBalance:
                currentValue = this.wlc.getMicrophone()?.balanceIndex;
                break;
            default:
                break;
        }

        this.wlc.setMicrophoneConfig(context, property, value + currentValue);

        // Only for slider keys: Update key icon and notify buddy key
        if (settings.actionStyle != 0) {
            this.setKeyIcons(context);
            this.wlc.emitEvent(kJSONPropertyMicrophoneConfigChanged, { context: context, property: kPropertyMicrophoneOutputVolume });
        }

        this.keyTimer.set(context, setTimeout(() => this.adjustValue(context, property, value), 200));
    }

    getNextLowcutType() {
        const microphone = this.wlc.getMicrophone();

        if (microphone?.lowCutType >= 2)
            return 0;
        else
            return microphone?.lowCutType + 1;
    }

    muteHardware(context, payload) {
        try {
            const isInMultiAction = payload?.isInMultiAction;
            const newValue = isInMultiAction ? !payload.userDesiredState : !this.wlc.getMicrophone()?.isMicMuted;

            this.wlc.setMicrophoneConfig(context, kPropertyMicrophoneMute, newValue);
        } catch (error) {
            $SD.showAlert(context);
            console.error(error);
        }
    }

    isActionUpdateNeeded(waveLinkPropertyID, pluginPropertyID) {
        switch (waveLinkPropertyID) {
            case kPropertyMicrophoneGain:
                return pluginPropertyID == kPropertyAdjustGain;
            case kPropertyMicrophoneOutputVolume:
                return pluginPropertyID == kPropertyAdjustOutput;
            case kPropertyMicrophoneBalance:
                return pluginPropertyID == kPropertyAdjustMicPcBalance;
            case kPropertyMicrophoneLowCut:
            case kPropertyMicrophoneLowCutType:
                return pluginPropertyID == kPropertyToggleLowcut;
            case kPropertyMicrophoneClipGuard:
                return pluginPropertyID == kPropertyToggleClipguard; 
            case kPropertyMicrophoneGainLock:
                return pluginPropertyID == kPropertytoggleGainLock;
            case kPropertyMicrophoneMute:
                switch (pluginPropertyID) {
                    case kPropertyToggleHardwareMute:
                    case kPropertyAdjustGain:
                    case kPropertyAdjustOutput:
                    case kPropertyAdjustMicPcBalance:
                        return true;
                    default:
                        return false;
                }
            default:
                return false;
        }
    }

    isAdjustAction(actionType) {
        switch (actionType) {
            case kPropertyAdjustGain:
            case kPropertyAdjustOutput:
            case kPropertyAdjustMicPcBalance:
                return true;
            default:
                return false;
        }
    }

	isSupportedByDevice(micSettingsAction, deviceType) {
		if (deviceType == DeviceType.WaveNeo) {
			switch (micSettingsAction) {
				case 'setMic/PcBalance':
				case 'adjustMic/PcBalance':
				case 'setLowcut':
				case 'setClipguard':
					return false;
				default:
					return true;
			}
		} else
			return true;
	}

	checkForValidExecutionConditions(settings) {
        switch (settings.actionType) {
            case ActionType.SetOutput: {
                const outputs = settings.mixerID == kPropertyMixerIDLocal ? this.wlc.localOutputs : this.wlc.streamOutputs;

                return settings.primOutput != undefined && outputs?.find(output => output.identifier == settings.primOutput) != undefined;
            }
            case ActionType.ToggleOutput: {
                if (settings.primOutput == undefined || settings.secOutput == undefined) {
                    return false;
                } else {
                    const foundFirstOutput  = this.wlc.localOutputs?.find(output => output.identifier == settings.primOutput) != undefined;
                    const foundSecondOutput = this.wlc.streamOutputs?.find(output => output.identifier == settings.secOutput) != undefined;

                    return foundFirstOutput && foundSecondOutput;
                }
            }
            case ActionType.SetDeviceSettings:
                return this.wlc.getMicrophone() != undefined;
            default:
                true;
        }
    }

    // Creates a payload object for "SetFeedback", parameters are action context and a boolean, if a specific element should be set or not 
    createFeedbackPayload(context, setTitle, setImage, setValue, setIndicator) {
        const microphone    = this.wlc.getMicrophone();
        const payload       = {};
        const isDisabled    = !this.isAppStateOk() || microphone == undefined;

        const settings      = this.actions.get(context).settings;
        const deviceSetting = settings.micSettingsAction;

        if (setTitle) {
            payload.title = {
                value: `${this.wlc.localization?.Actions?.MicSettingsTouch?.[deviceSetting]}`
            }
        }

        if (setImage) {
            const muteState = ~~microphone?.isMicMuted ? kPropertySuffixMuted : '';

            if (deviceSetting == kPropertyAdjustMicPcBalance) {
                payload.icon1 = {
                    value: this.awl.touchIconsHardware[kPropertyAdjustMicPcBalance + kPropertySuffixMinus + muteState],
                    opacity: isDisabled ? 0.5 : 1
                };

                payload.icon2 = {
                    value: this.awl.touchIconsHardware[kPropertyAdjustMicPcBalance + kPropertySuffixPlus + muteState],
                    opacity: isDisabled ? 0.5 : 1
                };
            } else {
                payload.icon = {
                    value: this.awl.touchIconsHardware[deviceSetting + muteState],
                    opacity: isDisabled ? 0.5 : 1
                };
            }
        }

        if (setValue || setIndicator) {
            var value          = 0;
            var indicatorValue = 0;

            const isMuted = ~~microphone?.isMicMuted;

            switch (deviceSetting) {
                case kPropertyAdjustGain:
                    if (this.useLevelmeter(context, settings.actionStyle, settings.micSettingsAction)) {
                        //const [firstKey] = this.wlc.microphones.keys();
                        //const input = this.wlc.inputs.find((input, index) => input.identifier.includes(firstKey));

                        const levelLeft  = isMuted ? 0 : this.wlc.getMicrophone()?.levelLeft || 0;
                        const levelRight = isMuted ? 0 : this.wlc.getMicrophone()?.levelRight || 0;

                        setIndicator     = false;

                        payload.levelmeterTop = {
                            value: this.getLevelmeterSVG(levelLeft),
                            opacity: isDisabled ? 0 : 1
                        }

                        payload.levelmeterBottom = {
                            value: this.getLevelmeterSVG(levelRight, true),
                            opacity: isDisabled ? 0 : 1
                        }
                    } else {
                        indicatorValue = isDisabled ? 0 : this.wlc.getValueConverter(deviceSetting).getFirstValueFromIndex(microphone.gainIndex) * 100;
                    }
                    value = isDisabled ? 0 : this.wlc.getValueConverter(deviceSetting).getSecondValueFromIndex(microphone.gainIndex);
                    break;
                case kPropertyAdjustOutput:
                    if (this.useLevelmeter(context, settings.actionStyle, settings.micSettingsAction)) {
                        const output = this.wlc.getOutput();

                        const currentLevel = isDisabled ? 0 : this.wlc.getValueConverter(deviceSetting).getFirstValueFromIndex(microphone.outputVolumeIndex);
                        const levelLeft    = isMuted ? 0 : currentLevel * (this.wlc.switchState == kPropertyMixerIDLocal ? output?.local.levelLeft : output?.stream.levelLeft);
                        const levelRight   = isMuted ? 0 : currentLevel * (this.wlc.switchState == kPropertyMixerIDLocal ? output?.local.levelRight : output?.stream.levelRight);

                        setIndicator = false;

                        payload.levelmeterTop = {
                            value: this.getLevelmeterSVG(levelLeft),
                            opacity: isDisabled ? 0 : 1
                        }

                        payload.levelmeterBottom = {
                            value: this.getLevelmeterSVG(levelRight, true),
                            opacity: isDisabled ? 0 : 1
                        }
                    } else {
                        indicatorValue = isDisabled ? 0 : this.wlc.getValueConverter(deviceSetting).getFirstValueFromIndex(microphone.outputVolumeIndex) * 100;
                    }
                    value = isDisabled ? 0 : this.wlc.getValueConverter(deviceSetting).getSecondValueFromIndex(microphone.outputVolumeIndex);
                    break;
                case kPropertyAdjustMicPcBalance:
                    indicatorValue = microphone?.balanceIndex || 0;
                    break;
                default:
                    return;
            }

            if (setValue && deviceSetting != kPropertyAdjustMicPcBalance) {
                const unit        = this.wlc.localization['Actions']?.['Common']?.decibel;
                const titleVolume = isMuted ? this.wlc.localization['Actions']?.['Common']?.['muted'] : `${value} ${unit || ''}`;

                payload.value = {
                    value: isDisabled ? '--' : titleVolume,
                    color: isMuted && !isDisabled ? '#E12A40' : 'white',
                    opacity: isDisabled ? 0.5 : 1
                }
            }

            if (setIndicator) {
                payload.indicator = {
                value: indicatorValue,
                opacity: isDisabled ? 0 : 1
                }
            }
        }

        return payload;
    }
}