"use strict";

const events = require( 'events' );

const ESedge = require( 'es-edge' );

const Escalation = require( './escalation.js' );

class Notify extends events.EventEmitter {

	constructor( options ) {
		super();

		if( options === undefined ) options = {};

		// Validate options
		// - receptor
		if( ! ( options.receptor instanceof ESedge.Classes.Sink ) ) {
			throw new Error( "'receptor' must be a receptor instance" );
		}
		// - escalationLevels
		if( options.escalationLevels instanceof Array ) {
			options.escalationLevels.forEach( ( level ) => {
				if( ! ( level.recipients instanceof Array ) ) {
					throw new Error( "'escalationLevels[].recipients' must be an array" );
				}
				if( level.delay && typeof level.delay != 'number' ) {
					throw new Error( "'escalationLevels[].delay' must be a number" );
				}
			} );
		} else if(  typeof options.escalationLevels != 'function' ) {
			throw new Error( "'escalationLevels' must be an array or function" );
		}
		// - escalateHormoneExpiration
		if( options.escalateHormoneExpiration === undefined ) {
			options.escalateHormoneExpiration = true;
		} else if( typeof options.escalateHormoneExpiration != 'boolean' ) {
			throw new Error( "'escalateHormoneExpiration' must be a boolean" );
		}
		// - escalateHormoneError
		if( options.escalateHormoneError === undefined ) {
			options.escalateHormoneError = true;
		} else if( typeof options.escalateHormoneError != 'boolean' ) {
			throw new Error( "'escalateHormoneError' must be a boolean" );
		}
		// - backends
		if( typeof options.backends != 'object' ) {
			throw new Error( "'backends' must be an object of backend instances" );
		} else {
			for( let name in options.backends ) {
				let b = options.backends[ name ];
				if(
					typeof b != 'object' ||
					typeof b.error != 'function' ||
					typeof b.acknowledge != 'function' ||
					typeof b.recover != 'function' ||
					! ( b instanceof events.EventEmitter )
				) {
					throw new Error( "'backends[]' must be an instance of backend" );
				}
			}
		}


		// Store options
		this._receptor = options.receptor;
		this._escalationLevels = options.escalationLevels;
		this._backends = options.backends;
		this._escalateHormoneExpiration = options.escalateHormoneExpiration;
		this._escalateHormoneError = options.escalateHormoneError;

		// Setup stores
		this._escalations = {};


		// Setup required event listeners
		this._receptorListeners = {};
		if( options.escalateHormoneExpiration ) {

			// Escalate on expiration
			this._receptorListeners.hormoneExpiration = ( env ) => this._escalate( env );
			options.receptor.on(
				'hormoneExpiration',
				this._receptorListeners.hormoneExpiration
			);

			// Deescalate when hormone has been refreshed
			this._receptorListeners.hormoneRefresh = ( env ) => this._deescalate( env );
			options.receptor.on(
				'hormoneRefresh',
				this._receptorListeners.hormoneRefresh
			);

		}

		if( options.escalateHormoneError ) {

			// Escalate on error
			this._receptorListeners.hormoneError = ( env ) => this._escalate( env );
			options.receptor.on(
				'hormoneError',
				this._receptorListeners.hormoneError
			);

			// Deescalate when hormone has been recovered
			this._receptorListeners.hormoneRecovery = ( env ) => this._deescalate( env );
			options.receptor.on(
				'hormoneRecovery',
				this._receptorListeners.hormoneRecovery
			);

		}

		// Also deescalate undefined hormones
		this._receptorListeners.undefined = ( env ) => this._deescalate( env );
		options.receptor.on(
			'undefined',
			this._receptorListeners.undefined
		);

		// Bypass error events of the backends
		this._backendListeners = {};
		for( let b in options.backends ) {
			this._backendListeners[ b ] = ( e ) => this.emit( e );
			options.backends[ b ].on( 'error', this._backendListeners[ b ] );
		}

		this.emit( 'ready' );

	}

	_escalate( hormone ) {

		let name = hormone.name;

		if( this._escalations[ name ] ) {

			// If this hormone has been escalated update hormone data
			this._escalations[ name ].update( hormone );

		} else {

			// Get the escalation levels. It might be an array or a callback function
			let eLevelsDeferred;
			if( typeof this._escalationLevels == 'function' ) {
				// The callback function will return the escalation levels eventually
				let ret = this._escalationLevels( name );
				// If no promise has been returned convert it into one ...
				eLevelsDeferred = ( ret instanceof Promise ) ? ret : Promise.resolve( ret );
			} else {
				// It's an array -> resolve the array
				eLevelsDeferred = Promise.resolve( this._escalationLevels );
			}

			eLevelsDeferred.then( ( levels ) => {

				// Something might will go wrong ... safety first ;)
				try {

					// Start a new escalation
					this._escalations[ name ] = new Escalation( this._backends, name, hormone, levels, this );

				} catch( e ) {

					// Something went wrong -> Emit error event
					this.emit( 'error', e );

				}

			} );

		}

	}

	_deescalate( hormone ) {

		let name = hormone.name;

		// If no escalation is known regarding the given hormone -> skip
		if( ! this._escalations[ name ] ) return;

		// Maybe it's not time to deescalate -> update
		if(
			hormone.error !== undefined && this._escalateHormoneError && hormone.error > 0 ||
			hormone.isFresh !== undefined && this._escalateHormoneExpiration && ! hormone.isFresh
		) {

			this._escalations[ name ].update( hormone );

		} else {

			// Deescalate and delete when hormone has been refreshed
			this._escalations[ name ].deescalate();

			// Remove instance
			delete this._escalations[ name ];

		}

	}

	shutdown( deescalate ) {

		// Remove event listeners
		for( let l in this._receptorListeners ) {
			this._receptor.removeListener( l, this._receptorListeners[ l ] );
		}
		for( let b in this._backends ) {
			this._backends[ b ].removeListener( 'error', this._backendListeners[ b ] );
		}

		// Deescalate
		if( deescalate === true ) {
			for( let e in this._escalations ) {
				this._deescalate( e );
			}
		}

	}

}

module.exports = Notify;
