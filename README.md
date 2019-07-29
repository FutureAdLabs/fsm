# fsm
A finite state machine using erx

## Overview and structure

Our FSM is responsible for maintaining current state and triggering navigation to other states. It is basically a description of the user journey during the running of an adunit; what happens and when it happens. When initialising the machine, the FSM takes two parameters:

- *Triggers*
- *Entries*

The *Triggers* are a set of conditions that determine whether or not the machine will navigate to the next state. (when/how)
The *Entries* are what happens while in each respective state. (what)

As a wise man once said; 
”Watch this” (triggers)
”Do that” (entries)

Trigger example:

```
"start": {
  "paint:start:reveal-layer": () => "revealing"
},
"win": {...},
...
```

When in the start state, if a "paint:start:reveal-layer" event is "sent" to the machine, then machine.goto("revealing") state (and then run that "revealing" entry function)

Entry example:

```
"start": {
  animations: (m, state) => {
    let rep = m.whileIn(anim.start(state), "start");
    return update.stream(state.events, rep);
  },
  onEnter: () => {},
  onExit: () => {}
},
"win": {...},
...
```

When in "start" state run "onEnter" and then "animations" functions. When leaving "start" state, run "onExit" function.
Entries are broken down into three parts:

- *animations*
- *onEnter*
- *onExit*

The *onEnter* function is used to "set-up" the scene for the next state and ensure that code can be run before the animations even occur. Examples of how this could be useful include, adding a node that you want to animate in the state, or adding a component to a node (in reality, adding a nodeId to the systems object) so that the user can interact with that node and trigger a state change.

The *animations* function is used for determining which animations will play in that state. The update.stream function is thennable, allowing you to chain animations if you please. An onAnimationEvent is pushed to cyan's eventBus automatically after every animation has concluded, which may or may not be caught with an appropriate trigger.

The *onExit* function is used for clearing up unwanted ... stuff; nodes, components, clearing Timeouts etc. It is fired whenever you exit the attached state.

## Old FSM 1.01 -> New ?

A small but significant refactor of FSM was required in order to increase the flexibility in order to deal with edge cases and ensure predictable behaviour, in preparation for the creation of a new Studio product harnessing a new programmatically generated json structure (cyan-json).
An instance of FSM was previously constructed with 3 props; new FSM(states(triggers), transitions, entries). 
First of all "states" was renamed to "triggers" to better describe their use, and the underlying logic tweaked to allow for passing of state events, or the state names themselves.
Secondly the "transitions" object was merged with entries and made specific to a single state in the form of hooks (onEnter, onExit), rather than being a function that is called when navigating between two states.
Third, code that would normally be run in the entry function could be split in terms of the concerns into animations (that must happen during the state) and everything else. This nicely provides a standard so that states correspond indirectly to the animations inside them. (That was the worst sentence ever) 

## What we need to think about during the upgrading process

...
