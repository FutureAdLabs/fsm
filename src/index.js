/* @flow -*- mode: flow -*- */

import Promise from "@adludio/erx/promise";
import * as erx from "@adludio/erx";

type State = string;
type Event = string;
type EventFn<A> = (m: Machine, data: A) => ?State;
type TriggerTable = { [state: State]: { [event: Event]: EventFn } };
type TransitionFn<A> = (m: Machine, data: A) => boolean | Promise<boolean>;
type TransitionTable = { [state1: State]: { [state2: State]: TransitionFn } };
type EntryFn<A> = (m: Machine, data: A) => ?State;
type EntryTable = { [state: State]: EntryFn };

function p<A>(val: A | Promise<A>): Promise<A> {
  return (val && val.then && typeof val.then === "function") ? val : Promise.resolved(val);
}

function match(table: TransitionTable, s1: State, s2: State): ?TransitionFn {
  const tPrime = table[s1] || table["*"];
  if (tPrime == null) {
    return null;
  }
  return tPrime[s2] || tPrime["*"];
}

export default class Machine extends erx.Bus<State> {
  state: State;
  triggers: TriggerTable;
  transitions: TransitionTable;
  entries: EntryTable;
  transitioning: boolean;

  constructor(triggers: TriggerTable, transitions?: TransitionTable, entries?: EntryTable) {
    super();
    this.state = null;
    this.triggers = triggers;
    this.transitions = (transitions != null) ? transitions : {};
    this.entries = (entries != null) ? entries : {};
    this.transitioning = false;
  }

  goTo(next: State, data?: any): boolean {
    const currEntries = this.transitions[this.state] || null;
    const nextEntries = this.transitions[next] || null;

    if (this.transitioning) {
      return false;
    }
    const finish = (next) => {
      this.state = next;
      this.push(next);
      if (nextEntries != null && nextEntries.before) {
        next = p(nextEntries.before(this, data)).then(function () {
          if(nextEntries.animations) {
            nextEntries.animations(this, data);
          }
        });
        if (typeof next === "string") {
          this.goTo(next, data);
        }
      }
    };
    if(currEntries != null && currEntries.after) {
      this.transitioning = true;
      p(currEntries.after(this, data)).then(function (change) {
        this.transitioning = false;
        change && finish(next);
      });
    } else {
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
    if (triggerExists(prevTrigger, triggers)) {
      nextState = triggers[prevTrigger][event](this, data)
    }

    const entries = this.entries;
    if (entryExists(entries, event)) {
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
