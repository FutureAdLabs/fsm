/* @flow -*- mode: flow -*- */

import Promise from "@adludio/erx/promise";
import * as erx from "@adludio/erx";

type State = string;
type Event = string;
type Animations = string;
type Hooks = string;
type EventFn<A> = (m: Machine, data: A) => ?State;
type TriggerTable = { [state: State]: { [event: Event]: EventFn } };
type TransitionFn<A> = (m: Machine, data: A) => boolean | Promise<boolean>;
type TransitionTable = { [state1: State]: { [state2: State]: TransitionFn } };
type StateFn<A> = (m: Machine, data: A) => ?State;
type AnimationFn<A> = (m: Machine, data: A) => ?Animations | Promise<?Animations>;
type HooksFn<A> = (m: Machine, data: A) => ?Hooks | Promise<?Hooks>;
type StatesTable = { [state: State]: { animations?: AnimationFn, onEnter?: HooksFn, onExit?: HooksFn } };

function p<A>(val: A | Promise<A>): Promise<A> {
  return (val && val.then && typeof val.then === "function") ? val : Promise.resolved(val);
}

function triggerExists(triggers: TriggerTable, trigger: State, event: Event): Boolean {
  return !!triggers[trigger] && !!triggers[trigger][event]
}

function stateExists(states: StatesTable, event: Event): Boolean {
  return !!states[event]
}

export default class Machine extends erx.Bus<State> {
  state: State;
  triggers: TriggerTable;
  states: StatesTable;
  transitioning: boolean;

  constructor(triggers: TriggerTable, states?: StatesTable) {
    super();
    this.state = null;
    this.triggers = triggers;
    this.states = (states != null) ? states : {};
    this.transitioning = false;
  }

  goTo(next: State, data?: any): boolean {
    const currState: ?StatesTable = this.states[this.state] || null;
    const nextState: ?StatesTable = this.states[next] || null;

    if (this.transitioning) {
      return false;
    }
    const finish = (next) => {
      this.state = next;
      this.push(next);
      
      if(nextState != null) {
        this.transitioning = true;
        if (nextState.onEnter) {        
          next = p(nextState.onEnter(this, data)).then(() => {
            this.transitioning = false;
            if(nextState.animations) {
              nextState.animations(this, data);
            }
          });
        } 
        else if (nextState.animations) {
          next = nextState.animations(this, data);
        }
        if (typeof next === "string") {
          this.goTo(next, data);
        }
      }
    };

    if(currState != null && currState.onExit) {
      this.transitioning = true;
      p(currState.onExit(this, data)).then(() => {
        this.transitioning = false;
        finish(next);
      });
    }

    else {
      finish(next);
    }
    return true;
  }

  send(event: Event, data: any): boolean {
    if (!this.state || this.transitioning) {
      return false;
    }

    const prevTrigger: State = this.state;
    const triggers: TriggerTable = this.triggers;
    let nextState: ?State = null;
    if (triggerExists(triggers, prevTrigger, event)) {
      nextState = triggers[prevTrigger][event](this, data)
    }

    const states = this.states;
    if (stateExists(states, event)) {
      nextState = event
    }

    if (!nextState) {
      return true
    }
    return this.goTo(nextState, data);
  }

  whileIn<A>(stream: erx.Stream<A>, state: string): erx.Stream<A> {
    return stream.takeUntil(this.filter((s) => s !== state));
  }

  until<A>(stream: erx.Stream<A>, states: Array<string>): erx.Stream<A> {
    return stream.takeUntil(this.filter((s) => states.indexOf(s) >= 0));
  }
}
