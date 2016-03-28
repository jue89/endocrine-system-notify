# Endocrine System: Notifications

This is an Endocrine System Edge extension for bugging people upon hormone errors and/or expirations.


## Example

``` javascript
"use strict";

const ES = require( 'es-edge' );
const Notify = require( 'es-notify' );

// Establishing a connection to ES core.
// For further details checkout https://github.com/jue89/endocrine-system-edge/blob/master/README.md
let es = ES( ... );


// Define the notify instance
Notify( {
  receptor: es.newReceptor( '#' ),          // The receptor listens to all hormones
  backends: {                               // Definition of backends that will be used to get into touch with the recipients
    'backend1': new Backend1( ... ),
    'backend2': new Backend2( ... )
  },
  escalationLevels: [ {                     // First level will escalate immediately if an error occurs
    delay: 0,
    recipients: [ {
      name: "User 1",                       // Name of the recipient
      backend: 'backend1',                  // The backend that should be used to contact to recipient
      ...                                   // Backend1-related options ...
    }, {
      name: "User 2",                       // Name of the recipient
      backend: 'backend2',                  // The backend that should be used to contact to recipient
      ...                                   // Backend2-related options ...
    } ]
  }, {                                      // Second level will escalate 10min (600s) after the first one
    delay: 600,
    recipients: [ ... ]
  } ]
} );
```

## API

The Notify system can be required as follows. The API description refers to ```Notify```.
``` javascript
const Notify = require( 'es-notify' );
```

### Endocrine System Notify

``` javascript
let notify = Notify( options );
```

Starts a Notify instance und returns its handle.

```options``` can be:
 * ```receptor```: An instance of Receptor class that is observed.
 * ```escalateHormoneExpiration```: (optional) Escalate all hormone expirations that are received by the receptor. Default: true.
 * ```escalateHormoneError```: (optional) Escalate all hormone errors that are received by the receptor. Default: true.
 * ```backends```: Object containing backend instances that can be used to contact recipients.
 * ```escalationLevels```: An array or a function returning an array directly or via a promise. Every item is an escalation level described by an object:
   * ```delay```: (optional) The delay in seconds until this escalation level will be escalated after to former one. Default: 0s
   * ```recipients```: Array of all recipients of this escalation level. Every recipient is described by an object:
     * ```backend```: Name of the backend that shall be used to contact this recipient.
     * ```name```: Human-readable name of the recipient.
     * Further options depending of the backend.

### Class: Notify

The Notify handle ```notify``` offers some events and methods:


#### Event: error

``` javascript
notify.on( 'error', ( error ) => { ... } );
```

If an error occurs in the local Notify instance or its escalations or backends, this event will be emitted.


#### Event: ready

``` javascript
notify.on( 'ready', () => { ... } );
```

Will be emitted if the notify setup has been finished.


#### Event: escalate

``` javascript
notify.on( 'escalate', ( name, hormone ) => { ... } );
```

Will be emitted if an escalation has been kicked off.


#### Event: updateEscalation

``` javascript
notify.on( 'updateEscalation', ( name, hormone ) => { ... } );
```

Will be emitted if escalation data has been updated.


#### Event: acknowledged

``` javascript
notify.on( 'acknowledged', ( name, user ) => { ... } );
```

Will be emitted if an escalation has been acknowledged.


#### Event: deescalate

``` javascript
notify.on( 'deescalate', ( name ) => { ... } );
```

Will be emitted if an escalation has been deescalated.


#### Method: shutdown

``` javascript
es.shutdown( deescalate );
```

Shuts down the notify system. If ```deescalate``` is true, all escalations will be deescalated before shutting down.
