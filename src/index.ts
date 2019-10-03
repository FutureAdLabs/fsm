
import * as erx from "@adludio/erx";
import Promise from "@adludio/erx/promise";

type StateName = string;
type EventID = string;
type Animations = string;
type Hooks = string;

export type EventFn<A> = (m: Machine, data: A) => StateName | void;

export interface StatesTable {
  [StateName: string]: State
}

export interface TriggerTable {
  [StateName: string]: Trigger
}

export interface Trigger {
  [EventID: string]: EventFn<any>
} 

export interface State {
  animations?: AnimationFn<any>,
  onEnter?: HooksFn<any>,
  onExit?: HooksFn<any>
} 

type AnimationFn<A> = (m: Machine, data: A) => boolean | Promise<boolean>
type HooksFn<A> = (m: Machine, data: A) => boolean | Promise<boolean>;

function p<A>(val: A | Promise<A>): Promise<A> {
  return (val instanceof Promise ? val : Promise.resolved(val))
}

function triggerExists(triggers: TriggerTable, trigger: StateName, event: EventID): Boolean {
  return triggers[trigger] && !!triggers[trigger][event]
}

function stateExists(states: StatesTable, event: EventID): Boolean {
  return !!states[event]
}

export default class Machine extends erx.Bus<StateName> {
  state: StateName;
  lastState: StateName;
  triggers: TriggerTable;
  states: StatesTable;
  transitioning: boolean;

  constructor(states: StatesTable, triggers: TriggerTable = {}) {
    super();

    this.state = null;
    this.lastState = null
    
    this.states = states
    this.triggers = triggers;
    this.transitioning = false;
  }

  goTo(next: StateName, getState?: Function): boolean {
    const currState: State = this.states[this.state];
    const nextState: State = this.states[next];

    if (this.transitioning) { return false }
    if(!nextState) { throw new Error(`FSM Error: Tried to reach non-existant state: "${nextState}"`) }

    const finish = (next: StateName) => {
      
      this.lastState = this.state
      this.state = next
      
      this.push(next)
      
      this.transitioning = !!nextState.onEnter;

      if (nextState.onEnter) {
        p(nextState.onEnter(this, getState)).then(() => {
          this.transitioning = false;
          if(nextState.animations) { return nextState.animations(this, getState) }
        });
      } else if (nextState.animations) {
        nextState.animations(this, getState)
      } if (typeof next === "string") {
        this.goTo(next, getState);
      }
    };

    if(currState && currState.onExit) {
      this.transitioning = true;
      p(currState.onExit(this, getState)).then(() => {
        this.transitioning = false;
        finish(next);
      });
    } else {
      finish(next)
    }

    return true;
  }

  send(event: EventID, getState?: Function): boolean {
    if (!this.state || this.transitioning) { return false }

    const prevTrigger: StateName = this.state
    const triggers: TriggerTable = this.triggers

    let nextState: string | void;

    if (triggerExists(triggers, prevTrigger, event)) {
      nextState = triggers[prevTrigger][event](this, getState)
    }

    const states = this.states;

    if (stateExists(states, event)) {
      nextState = event
    }

    if (!nextState) {
      return true
    }

    return this.goTo(nextState, getState);
  }

  whileIn<A>(stream: erx.Stream<A>, state: StateName): erx.Stream<A> {
    return stream.takeUntil(this.filter((s) => s !== state))
  }

  until<A>(stream: erx.Stream<A>, states: Array<StateName>): erx.Stream<A> {
    return stream.takeUntil(this.filter((s) => states.indexOf(s) >= 0))
  }
}
