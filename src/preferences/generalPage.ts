/*
    Copyright 2025 Roman Lefler

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import { gettext as _g, onLanguageChange } from "../gettext.js";
import { WeatherProviderNames } from "../providers/provider.js";
import { AVAILABLE_LANGUAGES, getLanguageIndex } from "../languages.js";
import { setLanguage } from "../gettext.js";

function setVisibilites(value : boolean, ...widgets : Gtk.Widget[]) {
    for(let w of widgets) w.visible = value;
}

export class GeneralPage extends Adw.PreferencesPage {

    static {
        GObject.registerClass(this);
    }

    constructor(settings : Gio.Settings, window: Adw.PreferencesWindow) {

        super({
            title: _g("General"),
            icon_name: "preferences-system-symbolic"
        });

        // Language Selection Group
        const languageGroup = new Adw.PreferencesGroup({
            title: _g("Language"),
            description: _g("Select the interface language")
        });

        const languageNames = AVAILABLE_LANGUAGES.map(lang => lang.name);
        const languageModel = new Gtk.StringList({ strings: languageNames });
        const currentLanguage = settings.get_string("language") || 'auto';
        const languageRow = new Adw.ComboRow({
            title: _g("Interface Language"),
            subtitle: _g("Extension will reload after changing language"),
            model: languageModel,
            selected: getLanguageIndex(currentLanguage)
        });
        
        languageGroup.add(languageRow);
        this.add(languageGroup);

        const unitGroup = new Adw.PreferencesGroup({
            title: _g("Units"),
            description: _g("Configure units of measurement")
        });

        const unitPresetUnits = new Gtk.StringList({ strings: [
            _g("US"), _g("UK"), _g("Metric"), _g("Nordic"), _g("Custom")
        ]});
        const unitPresetFromEnumMap = [ 4, 0, 1, 2, 3 ];
        const curUnitPreset = settings.get_enum("unit-preset");
        const unitPresetRow = new Adw.ComboRow({
            title: _g("Units"),
            model: unitPresetUnits,
            selected: unitPresetFromEnumMap[curUnitPreset]
        });
        // Connecting on this one is done later
        unitGroup.add(unitPresetRow);

        const tempUnits = new Gtk.StringList();
        tempUnits.append(_g("Fahrenheit"));
        tempUnits.append(_g("Celsius"));
        const tempRow = new Adw.ComboRow({
            title: _g("Temperature"),
            model: tempUnits,
            selected: settings.get_enum("temp-unit") - 1,
        });
        unitGroup.add(tempRow);

        const speedUnits = new Gtk.StringList({ strings: [
            "mph", "m/s", "km/h", "Knots", "ft/s", "Beaufort"
        ]});
        const speedRow = new Adw.ComboRow({
            title: _g("Speed"),
            model: speedUnits,
            selected: settings.get_enum("speed-unit") - 1
        });
        unitGroup.add(speedRow);

        const pressureUnits = new Gtk.StringList({ strings: [
            "inHg", "hPa", "mmHg"
        ]});
        const pressureRow = new Adw.ComboRow({
            title: _g("Pressure"),
            model: pressureUnits,
            selected: settings.get_enum("pressure-unit") - 1
        });
        unitGroup.add(pressureRow);

        const rainMeasurementUnits = new Gtk.StringList({ strings: [
            "in", "mm", "cm", "pts"
        ]});
        const rainMeasurementRow = new Adw.ComboRow({
            title: _g("Rain Measurement"),
            model: rainMeasurementUnits,
            selected: settings.get_enum("rain-measurement-unit") - 1
        });
        unitGroup.add(rainMeasurementRow);

        const distanceUnits = new Gtk.StringList({ strings: [
            "mi", "km", "ft", "m"
        ]});
        const distanceRow = new Adw.ComboRow({
            title: _g("Distance"),
            model: distanceUnits,
            selected: settings.get_enum("distance-unit") - 1
        });
        unitGroup.add(distanceRow);

        // If unit preset is not custom, most unit rows shouldn't be shown
        setVisibilites(curUnitPreset === 0, tempRow, speedRow, pressureRow,
            rainMeasurementRow, distanceRow);

        // This line automatically reverses the mapping from enum to menu
        const unitPresetInverse = unitPresetFromEnumMap.reduce<number[]>(
            (out, v, i) => (out[v] = i, out), []
        );

        const directionUnits = new Gtk.StringList({ strings: [
            _g("Degrees"), _g("Eight-Point Compass")
        ]});
        const directionRow = new Adw.ComboRow({
            title: _g("Direction"),
            model: directionUnits,
            selected: settings.get_enum("direction-unit") - 1
        });
        unitGroup.add(directionRow);
        this.add(unitGroup);

        const weatherServiceGroup = new Adw.PreferencesGroup({
            title: _g("Weather Service"),
            description: _g("Configure how the weather is attained")
        });

        const wProvList = new Gtk.StringList({
            strings: WeatherProviderNames as string[]
        });
        const wProvRow = new Adw.ComboRow({
            title: _g("Weather Provider"),
            model: wProvList,
            selected: settings.get_enum("weather-provider") - 1
        });
        wProvRow.connect("notify::selected", () => {
            settings.set_enum("weather-provider", wProvRow.selected + 1);
            settings.apply();
        });
        weatherServiceGroup.add(wProvRow);
        this.add(weatherServiceGroup);

        const myLocGroup = new Adw.PreferencesGroup({
            title: _g("My Location"),
            description: _g("Configure how your location is found")
        });

        const myLocProvs = new Gtk.StringList();
        myLocProvs.append(`${_g("Online")} - ipapi.co`);
        myLocProvs.append(`${_g("Online")} - IPinfo`);
        myLocProvs.append(`${_g("System")} - Geoclue`);
        myLocProvs.append(_g("Disable"));
        const myLocProvFromEnum = [ 0x0, 1, 2, 3, 0 ];
        const myLocRow = new Adw.ComboRow({
            title: _g("Provider"),
            model: myLocProvs,
            selected: myLocProvFromEnum[settings.get_enum("my-loc-provider")]
        });
        myLocGroup.add(myLocRow);

        const myLocRefresh = new Adw.SpinRow({
            title: _g("Refresh Interval (Minutes)"),
            adjustment: new Gtk.Adjustment({
                lower: 10.0,
                upper: 10000,
                step_increment: 5.0,
                page_increment: 30.0,
                value: settings.get_double("my-loc-refresh-min")
            })
        });
        myLocRefresh.connect("notify::value", () => {
            settings.set_double("my-loc-refresh-min", myLocRefresh.value);
            settings.apply();
        });
        myLocGroup.add(myLocRefresh);

        this.add(myLocGroup);

        const a11yGroup = new Adw.PreferencesGroup({
            title: _g("Accessibility"),
            description: _g("Configure accessibility features")
        });
        const hiContrastRow = new Adw.SwitchRow({
            title: _g("High Contrast"),
            active: settings.get_boolean("high-contrast")
        });
        hiContrastRow.connect("notify::active", () => {
            settings.set_boolean("high-contrast", hiContrastRow.active);
            settings.apply();
        });
        a11yGroup.add(hiContrastRow);
        this.add(a11yGroup);

        const panelGroup = new Adw.PreferencesGroup({
            title: _g("Panel"),
            description: _g("Configure the panel and pop-up")
        });
        const themes = [
            "",
            "light",
            "afterdark",
            "immersive"
        ];
        const themeModel = new Gtk.StringList({ strings: [
            _g("System"),
            _g("Light"),
            _g("Afterdark"),
            _g("Immersive")
        ]});
        const themeRow = new Adw.ComboRow({
            title: _g("Theme"),
            model: themeModel,
            selected: Math.max(themes.indexOf(settings.get_string("theme")), 0)
        });
        panelGroup.add(themeRow);
        const panelBoxModel = new Gtk.StringList({ strings: [
            _g("Right"), _g("Center"), _g("Left")
        ]});
        const panelBoxRow = new Adw.ComboRow({
            title: _g("Side of Panel"),
            model: panelBoxModel,
            selected: settings.get_enum("panel-box")
        });
        panelGroup.add(panelBoxRow);
        const panelPriorityRow = new Adw.SpinRow({
            title: _g("Order in Panel"),
            adjustment: new Gtk.Adjustment({
                lower: -10000,
                upper: 10000,
                step_increment: 1,
                page_increment: 3,
                value: settings.get_int64("panel-priority")
            })
        });
        panelPriorityRow.connect("notify::value", () => {
            const int64 = Math.round(panelPriorityRow.value);
            settings.set_int64("panel-priority", int64);
            settings.apply();
        });
        panelGroup.add(panelPriorityRow);

        const panelOffsetRow = new Adw.ActionRow({
            title: _g("Pop-Up Offset"),
            subtitle: _g("Horizontal pop-up offset from 0\u2013100.")
        });
        const OFFSET_STEP = 5;
        const panelOffsetScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: -100.0,
                upper: 0.0,
                step_increment: 5.0,
                page_increment: 10.0,
                value: -settings.get_double("panel-offset")
            }),
            digits: 0,
            round_digits: OFFSET_STEP,
            draw_value: true, // show the number bubble/value
            hexpand: true
        });
        for(const i of [ 0, -50, -100 ]) {
            panelOffsetScale.add_mark(i, Gtk.PositionType.BOTTOM, null);
        }

        panelOffsetRow.add_suffix(panelOffsetScale);
        panelOffsetRow.set_activatable_widget(panelOffsetScale);
        const panelOffsetAdjustmentHandler = panelOffsetScale.adjustment.connect("notify::value", a => {
            if(a.value % OFFSET_STEP !== 0) {
                a.value = Math.round(a.value / OFFSET_STEP) * OFFSET_STEP;
            }
            settings.set_double("panel-offset", -a.value);
            settings.apply();
        });
        // Update UI when offset is changed by panel position setting
        settings.connect("changed", (_, key) => {
            if(key === "panel-offset") {
                const v = settings.get_double("panel-offset");
                // Block the adjustment handler to prevent infinite loop
                panelOffsetScale.adjustment.block_signal_handler(panelOffsetAdjustmentHandler);
                panelOffsetScale.adjustment.value = -v;
                panelOffsetScale.adjustment.unblock_signal_handler(panelOffsetAdjustmentHandler);
            }
        });
        panelGroup.add(panelOffsetRow);

        const useSymbolicRow = new Adw.SwitchRow({
            title: _g("Use Symbolic Icons in Panel"),
            active: settings.get_boolean("symbolic-icons-panel")
        });
        useSymbolicRow.connect("notify::active", () => {
            const val = useSymbolicRow.active;
            settings.set_boolean("symbolic-icons-panel", val);
            settings.apply();
        });
        panelGroup.add(useSymbolicRow);
        const alwaysPackagedRow = new Adw.SwitchRow({
            title: _g("Always Use Packaged Icons"),
            active: settings.get_boolean("always-packaged-icons")
        });
        alwaysPackagedRow.connect("notify::active", () => {
            const val = alwaysPackagedRow.active;
            settings.set_boolean("always-packaged-icons", val);
            settings.apply();
        });
        panelGroup.add(alwaysPackagedRow);

        const showRefreshButton = new Adw.SwitchRow({
            title: _g("Show Refresh Button"),
            active: settings.get_boolean("show-refresh-button")
        });
        showRefreshButton.connect("notify::active", w => {
            const val = w.active;
            settings.set_boolean("show-refresh-button", val);
            settings.apply();
        });
        panelGroup.add(showRefreshButton);

        const hideErrPopupRow = new Adw.SwitchRow({
            title: _g("Hide Error Popup"),
            subtitle: _g("If the popup just says Error, don't even show it."),
            active: settings.get_boolean("hide-err-popup")
        });
        hideErrPopupRow.connect("notify::active", w => {
            const val = w.active;
            settings.set_boolean("hide-err-popup", val);
            settings.apply();
        });
        panelGroup.add(hideErrPopupRow);

        this.add(panelGroup);

        // Track signal handlers to block them during language updates
        let languageRowHandlerId: number;
        let unitPresetRowHandlerId: number;
        let tempRowHandlerId: number;
        let speedRowHandlerId: number;
        let pressureRowHandlerId: number;
        let rainMeasurementRowHandlerId: number;
        let distanceRowHandlerId: number;
        let directionRowHandlerId: number;
        let themeRowHandlerId: number;
        let panelBoxRowHandlerId: number;
        let myLocRowHandlerId: number;

        // Connect signals and store handler IDs
        languageRowHandlerId = languageRow.connect("notify::selected", () => {
            console.log(`[SimpleWeather] languageRow selected changed to: ${languageRow.selected}`);
            const selectedLangCode = AVAILABLE_LANGUAGES[languageRow.selected].code;
            console.log(`[SimpleWeather] Setting language to: ${selectedLangCode}`);
            settings.set_string("language", selectedLangCode);
            settings.apply();
            
            // Apply the language change immediately
            setLanguage(selectedLangCode);
        });

        tempRowHandlerId = tempRow.connect("notify::selected", () => {
            settings.set_enum("temp-unit", tempRow.selected + 1);
            settings.apply();
        });

        speedRowHandlerId = speedRow.connect("notify::selected", () => {
            settings.set_enum("speed-unit", speedRow.selected + 1);
            settings.apply();
        });

        pressureRowHandlerId = pressureRow.connect("notify::selected", () => {
            settings.set_enum("pressure-unit", pressureRow.selected + 1);
            settings.apply();
        });

        rainMeasurementRowHandlerId = rainMeasurementRow.connect("notify::selected", () => {
            settings.set_enum("rain-measurement-unit", rainMeasurementRow.selected + 1);
            settings.apply();
        });

        distanceRowHandlerId = distanceRow.connect("notify::selected", () => {
            settings.set_enum("distance-unit", distanceRow.selected + 1);
            settings.apply();
        });

        directionRowHandlerId = directionRow.connect("notify::selected", () => {
            settings.set_enum("direction-unit", directionRow.selected + 1);
            settings.apply();
        });

        themeRowHandlerId = themeRow.connect("notify::selected", (w : Adw.ComboRow) => {
            settings.set_string("theme", themes[w.selected]);
            settings.apply();
        });

        panelBoxRowHandlerId = panelBoxRow.connect("notify::selected", () => {
            settings.set_enum("panel-box", panelBoxRow.selected);
            // Auto-adjust panel offset based on panel position
            const offsetValues = [0, 50, 100];
            settings.set_double("panel-offset", offsetValues[panelBoxRow.selected]);
            settings.apply();
        });

        myLocRowHandlerId = myLocRow.connect("notify::selected", () => {
            const myLocProvToEnum = [ 4, 1, 2, 3 ];
            settings.set_enum("my-loc-provider", myLocProvToEnum[myLocRow.selected]);
            settings.apply();
        });

        unitPresetRowHandlerId = unitPresetRow.connect("notify::selected", () => {
            const val = unitPresetInverse[unitPresetRow.selected];
            setVisibilites(val === 0, tempRow, speedRow, pressureRow,
                rainMeasurementRow, distanceRow);

            settings.set_enum("unit-preset", val);
            settings.apply();
        });

        // Update all translatable content when language changes
        onLanguageChange(() => {
            this.title = _g("General");
            
            languageGroup.title = _g("Language");
            languageGroup.description = _g("Select the interface language");
            languageRow.title = _g("Interface Language");
            languageRow.subtitle = _g("Extension will reload after changing language");
            
            unitGroup.title = _g("Units");
            unitGroup.description = _g("Configure units of measurement");
            unitPresetRow.title = _g("Units");
            tempRow.title = _g("Temperature");
            speedRow.title = _g("Speed");
            pressureRow.title = _g("Pressure");
            rainMeasurementRow.title = _g("Rain Measurement");
            distanceRow.title = _g("Distance");
            directionRow.title = _g("Direction");
            
            weatherServiceGroup.title = _g("Weather Service");
            weatherServiceGroup.description = _g("Configure how the weather is attained");
            wProvRow.title = _g("Weather Provider");
            
            myLocGroup.title = _g("My Location");
            myLocGroup.description = _g("Configure how your location is found");
            myLocRow.title = _g("Provider");
            myLocRefresh.title = _g("Refresh Interval (Minutes)");
            
            a11yGroup.title = _g("Accessibility");
            a11yGroup.description = _g("Configure accessibility features");
            hiContrastRow.title = _g("High Contrast");
            
            panelGroup.title = _g("Panel");
            panelGroup.description = _g("Configure the panel and pop-up");
            themeRow.title = _g("Theme");
            panelBoxRow.title = _g("Side of Panel");
            panelPriorityRow.title = _g("Order in Panel");
            panelOffsetRow.title = _g("Pop-Up Offset");
            panelOffsetRow.subtitle = _g("Horizontal pop-up offset from 0\u2013100.");
            useSymbolicRow.title = _g("Use Symbolic Icons in Panel");
            alwaysPackagedRow.title = _g("Always Use Packaged Icons");
            showRefreshButton.title = _g("Show Refresh Button");
            hideErrPopupRow.title = _g("Hide Error Popup");
            hideErrPopupRow.subtitle = _g("If the popup just says Error, don't even show it.");
            
            // Update dropdown StringLists - save selections and restore after update
            const savedSelections = {
                unitPreset: unitPresetRow.selected,
                temp: tempRow.selected,
                direction: directionRow.selected,
                theme: themeRow.selected,
                panelBox: panelBoxRow.selected,
                myLoc: myLocRow.selected
            };
            
            // Block all handlers during update to prevent loops
            unitPresetRow.block_signal_handler(unitPresetRowHandlerId);
            tempRow.block_signal_handler(tempRowHandlerId);
            directionRow.block_signal_handler(directionRowHandlerId);
            themeRow.block_signal_handler(themeRowHandlerId);
            panelBoxRow.block_signal_handler(panelBoxRowHandlerId);
            myLocRow.block_signal_handler(myLocRowHandlerId);
            
            try {
                unitPresetUnits.splice(0, unitPresetUnits.get_n_items(), [
                    _g("US"), _g("UK"), _g("Metric"), _g("Nordic"), _g("Custom")
                ]);
                unitPresetRow.selected = savedSelections.unitPreset;
                
                tempUnits.splice(0, tempUnits.get_n_items(), [
                    _g("Fahrenheit"), _g("Celsius")
                ]);
                tempRow.selected = savedSelections.temp;
                
                directionUnits.splice(0, directionUnits.get_n_items(), [
                    _g("Degrees"), _g("Eight-Point Compass")
                ]);
                directionRow.selected = savedSelections.direction;
                
                themeModel.splice(0, themeModel.get_n_items(), [
                    _g("System"), _g("Light"), _g("Afterdark"), _g("Immersive")
                ]);
                themeRow.selected = savedSelections.theme;
                
                panelBoxModel.splice(0, panelBoxModel.get_n_items(), [
                    _g("Right"), _g("Center"), _g("Left")
                ]);
                panelBoxRow.selected = savedSelections.panelBox;
                
                myLocProvs.splice(0, myLocProvs.get_n_items(), [
                    `${_g("Online")} - ipapi.co`,
                    `${_g("Online")} - IPinfo`,
                    `${_g("System")} - Geoclue`,
                    _g("Disable")
                ]);
                myLocRow.selected = savedSelections.myLoc;
            } finally {
                // Always unblock handlers
                unitPresetRow.unblock_signal_handler(unitPresetRowHandlerId);
                tempRow.unblock_signal_handler(tempRowHandlerId);
                directionRow.unblock_signal_handler(directionRowHandlerId);
                themeRow.unblock_signal_handler(themeRowHandlerId);
                panelBoxRow.unblock_signal_handler(panelBoxRowHandlerId);
                myLocRow.unblock_signal_handler(myLocRowHandlerId);
            }
        });
    }

}
