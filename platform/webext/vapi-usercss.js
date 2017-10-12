/*******************************************************************************

    uBlock Origin - a browser extension to block requests.
    Copyright (C) 2017 Raymond Hill

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/gorhill/uBlock
*/

'use strict';

// For content pages

/******************************************************************************/

vAPI.DOMFilterer = function() {
    this.commitTimer = new vAPI.SafeAnimationFrame(this.commitNow.bind(this));
    this.domIsReady = document.readyState !== 'loading';
    this.hideNodeId = vAPI.randomToken();
    this.hideNodeStylesheet = false;
    this.stagedCSSRules = [];

    this.userStylesheets = {
        sheets: new Set(),
        disabled: false,
        apply: function(add, css) {
            vAPI.messaging.send('vapi-background', {
                what: 'userCSS',
                add: add,
                css: css
            });
        },
        add: function(cssText) {
            if ( cssText === '' || this.sheets.has(cssText) ) { return; }
            this.sheets.add(cssText);
            if ( this.disabled ) { return; }
            this.apply(true, cssText);
        },
        remove: function(cssText) {
            if ( cssText === '' ) { return; }
            if ( this.sheets.delete(cssText) ) {
                this.apply(false, cssText);
            }
        },
        toggle: function(state) {
            if ( state === undefined ) { state = this.disabled; }
            if ( state !== this.disabled ) { return; }
            this.disabled = !state;
            if ( this.sheets.size === 0 ) { return; }
            this.apply(state, Array.from(this.sheets));
        }
    };

    if ( this.domIsReady !== true ) {
        document.addEventListener('DOMContentLoaded', () => {
            this.domIsReady = true;
            this.commit();
        });
    }
};

vAPI.DOMFilterer.prototype = {
    commitNow: function() {
        this.commitTimer.clear();

        var stylesheetParts = [], cssRule,
            i = this.stagedCSSRules.length;
        while ( i-- ) {
            cssRule = this.stagedCSSRules[i];
            if ( cssRule.lazy !== true || this.domIsReady ) {
                stylesheetParts.push(
                    cssRule.selectors,
                    '{ ' + cssRule.declarations + ' }'
                );
                this.stagedCSSRules.splice(i, 1);
            }
        }

        if ( stylesheetParts.length !== 0 ) {
            this.userStylesheets.add(stylesheetParts.join('\n'));
        }
    },

    commit: function(commitNow) {
        if ( commitNow ) {
            this.commitTimer.clear();
            this.commitNow();
        } else {
            this.commitTimer.start();
        }
    },

    addCSSRule: function(
        selectors,
        declarations,
        options
    ) {
        if ( Array.isArray(selectors) ) {
            selectors = selectors.join(',\n');
        }
        if ( typeof selectors !== 'string' || selectors.length === 0 ) {
            return;
        }
        this.stagedCSSRules.push({
            selectors,
            declarations,
            lazy: options && options.lazy === true
        });
    },

    hideNode: function(node) {
        node.setAttribute(this.hideNodeId, '');
        if ( this.hideNodeStylesheet === false ) {
            this.hideNodeStylesheet = true;
            this.addCSSRule(
                '[' + this.hideNodeId + ']',
                'display: none !important;'
            );
        }
    },

    unhideNode: function(node) {
        node.removeAttribute(this.hideNodeId);
    },

    toggle: function(state) {
        this.userStylesheets.toggle(state);
    },

    getFilteredElementCount: function() {
        let resultset = new Set();
        for ( var sheet of this.userStylesheets.sheets ) {
            let nodes = document.querySelectorAll(sheet.replace(/^\{[^\n]+\}\n?/gm, ''));
            let i = nodes.length;
            while ( i-- ) {
                resultset.add(nodes[i]);
            }
        }
        return resultset.size;
    }
};
