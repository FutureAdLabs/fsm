/* @flow -*- mode: flow -*- */

import Promise from "@adludio/erx/promise";
import * as erx from "@adludio/erx";

type State = string;
type Event = string;
type EventFn<A> = (m: Machine, data: A) => ?State;
type StateTable = { [state: State]: { [event: Event]: EventFn } };
type TransitionFn<A> = (m: Machine, data: A) => boolean | Promise<boolean>;
type TransitionTable = { [state1: State]: { [state2: State]: TransitionFn } };
type EntryFn<A> = (m: Machine, data: A) => ?State;
type EntryTable = { [state: State]: EntryFn };

function p<A>(val: A | Promise<A>): Promise<A> {
  return (val instanceof Promise) ? val : Promise.resolved(val);
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
  states: StateTable;
  transitions: TransitionTable;
  entries: EntryTable;
  transitioning: boolean;

  constructor(states: StateTable, transitions?: TransitionTable, entries?: EntryTable) {
    super();
    this.state = null;
    this.states = states;
    this.transitions = (transitions != null) ? transitions : {};
    this.entries = (entries != null) ? entries : {};
    this.transitioning = false;
  }

  goTo(next: State, data?: any): boolean {
    if (this.transitioning) {
      return false;
    }
    const finish = (next) => {
      this.state = next;
      this.push(next);
      const eFn = this.entries[next];
      if (eFn != null) {
        next = eFn(this, data);
        if (typeof next === "string") {
          this.goTo(next, data);
        }
      }
    };
    const tFn = match(this.transitions, this.state, next);
    if (tFn != null) {
      this.transitioning = true;
      p(tFn(this, data)).then((change) => {
         if (change instanceof Promise) {
          change.then((hasChanged) => {
            this.transitioning = false; 
            hasChanged && finish(next);
          })
        }else {
          this.transitioning = false;
          change && finish(next);
        }
      });
    } else {
      finish(next);
    }
    return true;
  }

  send(event: Event, data: any): boolean {
    if (!this.state || !this.states[this.state] || this.transitioning) {
      return false;
    }
    const prev: State = this.state;
    const table: StateTable = this.states[this.state];
    const fn: any = table[event]; // FIXME How to get Flow to accept this without the `any` here?
    const next: ?State = fn ? fn(this, data) : null;
    if (next != null) {
      return this.goTo(next, data);
    }
    return true;
  }

  whileIn<A>(stream: erx.Stream<A>, state: string): erx.Stream<A> {
    return stream.takeUntil(this.filter((s) => s !== state));
  }

  until<A>(stream: erx.Stream<A>, states: Array<string>): erx.Stream<A> {
    return stream.takeUntil(this.filter((s) => states.indexOf(s) >= 0));
  }
}
