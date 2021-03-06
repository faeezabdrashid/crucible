import m from "mithril";
import debounce from "lodash.debounce";

import name from "../name.js";

import css from "../invalid-msg.css";

function reqPrefix(name) {
    return "Required: " + name;
}

export default function Validity(content) {
    this.handlersAttached = false;
    this.content = content;
}

Validity.prototype = {

    // Private functions.
    _show : function() {
        var wasInvalid = this.content.get().ui.invalid;

        this.content.toggleInvalid(true);
        if(!wasInvalid) {
            m.redraw(); // Only do once; avoid superfluous redraws.
        }
    },

    _hide : function() {
        // CSS transition does the rest.
        this.content.toggleInvalid(false);
        m.redraw();
    },

    // Public
    debounceFade : function() {
        var self = this;
        
        return debounce(
            self._hide.bind(self), 
            100
        );
    },

    attachInputHandlers : function() {
        var self = this,
            form = this.content.get().form.el;

        if(self.handlersAttached) {
            return;
        }

        self.handlersAttached = true;

        // Irritatingly, this attachment had to be delayed like this because the 
        // form's `config` function was running before the whole DOM tree was rendered,
        // so we were getting an incomplete list of inputs previously.
        form.querySelectorAll("input, textarea, select").forEach(function(formInput) {
            formInput.addEventListener("invalid", function(evt) {
                evt.target.classList.add(css.highlightInvalid);
                self.registerInvalidField(evt.target.name);
            });

            formInput.addEventListener("focus", function(evt) {
                evt.target.classList.remove(css.highlightInvalid);
                self.onFormFocus(evt); // focus doesn't bubble, so we listen to all the inputs for this.
            });
        });
    },

    checkForm : function() {
        var state = this.content.get();

        this.attachInputHandlers();
        state.form.valid = state.form.el.checkValidity();

        return state.form.valid;
    },

    registerInvalidField : function(name) {
        this.addInvalidField(name);
        this._show();
        this.debounceFade();
    },

    addInvalidField : function(name) {
        var prefixedName = reqPrefix(name);

        this.addInvalidMessage(prefixedName);
    },

    addInvalidMessage : function(msg) {
        var state = this.content.get();
           
        if(state.form.invalidMessages.indexOf(msg) > -1) {
            return;
        }

        state.form.invalidMessages.push(msg);
    },

    reset : function() {
        var state = this.content.get();

        state.form.valid = true;
        state.form.invalidMessages = [];
        this.content.toggleInvalid(false);
    },

    onFormFocus : function() {
        if(!this.content.get().form.valid) {
            this.debounceFade();
        }
    },

    checkSchedule : function() {
        var state = this.content.get(),
            pub   = state.dates.published_at,
            unpub = state.dates.unpublished_at,
            valid;

        valid = (!pub && !unpub) || // No schedule.
            (pub && !unpub)      || // Only have a pub date,
            (unpub && !pub)      || // Only have an unpub date.
            (pub && unpub && pub < unpub); // Have a valid pair of timestamps..

        state.dates.validSchedule = valid;
    },

    isValidSave : function() {
        var STATUS  = this.content.schedule.STATUS,
            state   = this.content.get(),
            isValid = true,
            requiresValid;

        if(state.meta.name === name(state.schema, {})) {
            // All saves must have a unique name.
            this.addInvalidMessage("Entry must have a title/name.");
            isValid = false;
        }

        this.content.schedule.updateStatus();

        requiresValid = [ STATUS.SCHEDULED, STATUS.PUBLISHED ].indexOf(state.meta.status) > -1;
        if(requiresValid) {
            this.checkForm();

            if(!state.form.valid) {
                this.addInvalidMessage("Cannot Publish with invalid or missing input.");
            }
        }

        this.checkSchedule();
        if(!state.dates.validSchedule) {
            isValid = false;
            this.addInvalidMessage("Invalid schedule.");
        }

        if(!state.form.valid || !isValid) {
            return false;
        }

        return true;
    }
};

