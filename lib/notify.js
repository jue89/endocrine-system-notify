"use strict";

const Escalation = require( './escalation.js' );

class Notify {

	constructor( options ) {

		// TODO Test options

		// Store options
		this._escalationLevels = options.escalationLevels;
		this._backend = options.backend;

		// Setup stores
		this._escalations = {};

		// Setup required event listeners
		if( options.escalateHormoneExpiration ) {

			// Escalate on expiration
			options.receptor.on(
				'hormoneExpiration',
				( name, hormone ) => this._escalate( name, hormone )
			);

			// Deescalate when hormone has been refreshed
			options.receptor.on(
				'hormoneRefresh',
				( name, hormone ) => this._deescalate( name )
			);

		}

		if( options.escalateHormoneError ) {

			// Escalate on error
			options.receptor.on(
				'hormoneError',
				( name, hormone ) => this._escalate( name, hormone )
			);

			// Deescalate when hormone has been recovered
			options.receptor.on(
				'hormoneRecovery',
				( name, hormone ) => this._deescalate( name )
			);

		}

		// Also deescalate undefined hormones
		options.receptor.on(
			'undefined',
			( name ) => this._deescalate( name )
		);

	}

	_escalate( name, hormone ) {

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

				// Start a new escalation
				this._escalations[ name ] = new Escalation( this._backend, name, hormone, levels );

			} );

		}

	}

	_deescalate( name ) {

		// If no escalation is known regarding the given hormone -> skip
		if( ! this._escalations[ name ] ) return;


		// Deescalate and delete when hormone has been refreshed
		this._escalations[ name ].deescalate();
		delete this._escalations[ name ];

	}

}

module.exports = Notify;
