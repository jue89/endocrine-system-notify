"use strict";

const assert = require( 'assert' );


describe( "Class Escalation", function() {

	let Escalation;
	let Hormone;
	let Backend;

	before( ( done ) => {

		// Install all mocks
		Hormone = require( './mocks/hormone.js' );
		Backend = require( './mocks/backend.js' );

		// Require all librarys required for tests
		Escalation = require( '../lib/escalation.js' );

		done();

	} );

	after( ( done ) => {

		done();

	} );

	it( "should reject due to wrong escalation levels definition: no array", ( done ) => {
		try {
			new Escalation(
				{ 'be': new Backend() },
				Hormone( 'test' ),
				true
			);
		} catch( e ) { /*console.log( e );*/ done(); }
	} );

	it( "should reject due to wrong escalation levels definition: delay no number", ( done ) => {
		try {
			new Escalation(
				{ 'be': new Backend() },
				Hormone( 'test' ),
				[ {
					delay: true,
					recipients: []
				} ]
			);
		} catch( e ) { /*console.log( e );*/ done(); }
	} );

	it( "should reject due to wrong escalation levels definition: recipients no array", ( done ) => {
		try {
			new Escalation(
				{ 'be': new Backend() },
				Hormone( 'test' ),
				[ {
					delay: 1,
					recipients: true
				} ]
			);
		} catch( e ) { /*console.log( e );*/ done(); }
	} );

	it( "should throw errors for all users without specified backend, but send notitfications to those without errors", ( done ) => {

		let be = new Backend();

		let e = new Escalation(
			{ 'be': be },
			Hormone( 'test' ),
			[ {
				delay: 0,
				recipients: [ {
					backend: 'be',
					name: "U1"
				}, {
					name: "U2"
				} ]
			} ]
		);

		e.on( 'error', ( err, env ) => {
			try {
				assert.strictEqual( be.sentErr.length, 1 );
				done();
			} catch( e ) {
				done( e );
			}
		} );

	} );

	it( "should throw errors for all users with unknown backend, but send notitfications to those without errors", ( done ) => {

		let be = new Backend();

		let e = new Escalation(
			{ 'be': be },
			Hormone( 'test' ),
			[ {
				delay: 0,
				recipients: [ {
					backend: 'be',
					name: "U1"
				}, {
					backend: 'be2',
					name: "U2"
				} ]
			} ]
		);

		e.on( 'error', ( e ) => {
			try {
				assert.strictEqual( be.sentErr.length, 1 );
				done();
			} catch( e ) {
				done( e );
			}
		} );

	} );

	it( "should throw errors for all users without name, but send notitfications to those without errors", ( done ) => {

		let be = new Backend();

		let e = new Escalation(
			{ 'be': be },
			Hormone( 'test' ),
			[ {
				delay: 0,
				recipients: [ {
					backend: 'be',
					name: "U1"
				}, {
					backend: 'be'
				} ]
			} ]
		);

		e.on( 'error', ( e ) => {
			try {
				assert.strictEqual( be.sentErr.length, 1 );
				done();
			} catch( e ) {
				done( e );
			}
		} );

	} );

	it( "should create an escalation and generate a UUID", ( done ) => {

		let be = new Backend();

		let e = new Escalation(
			{ 'be': be },
			Hormone( 'test' ),
			[ {
				delay: 0,
				recipients: [ ]
			} ]
		);

		let reUUIDv4 = new RegExp( "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$" );
		assert.ok( reUUIDv4.test( e.id ), "ID is no valid UUIDv4" );

		done();

	} );

	it( "should send error messages to users via the defined backend", ( done ) => {

		let be1 = new Backend();
		let be2 = new Backend();

		let e = new Escalation(
			{ 'be1': be1, 'be2': be2 },
			Hormone( 'test' ),
			[ {
				delay: 0,
				recipients: [ {
					backend: 'be1',
					name: "U1"
				}, {
					backend: 'be2',
					name: "U2"
				} ]
			} ]
		);

		be2.on( 'sentErr', () => {
			try {
				assert.strictEqual( be1.sentErr.length, 1 );
				assert.strictEqual( be2.sentErr.length, 1 );
				assert.strictEqual( be1.sentErr[0].recipient.name, "U1" );
				assert.strictEqual( be2.sentErr[0].recipient.name, "U2" );
				done();
			} catch( e ) {
				done( e );
			}
		} )

	} );

	it( "should inform all recipients of error message about acknowledge excluding the user who acked", ( done ) => {

		let be1 = new Backend();
		let be2 = new Backend();

		let e = new Escalation(
			{ 'be1': be1, 'be2': be2 },
			Hormone( 'test' ),
			[ {
				delay: 0,
				recipients: [ {
					backend: 'be1',
					name: "U1"
				}, {
					backend: 'be2',
					name: "U2"
				} ]
			}, {
				delay: 0.01,
				recipients: [ {
					backend: 'be1',
					name: "U3"
				}, {
					backend: 'be2',
					name: "U4"
				} ]
			}, {
				delay: 0.01,
				recipients: [ {
					backend: 'be1',
					name: "U5"
				}, {
					backend: 'be2',
					name: "U6"
				} ]
			} ]
		);

		be2.on( 'sentErr', ( recipient, name ) => {
			if( recipient.name == "U4" ) {
				be2.emit( 'ack_' + name, recipient );
			}
		} );

		e.on( 'acknowledged', ( env ) => {
			try {
				assert.strictEqual( be1.sentErr.length, 2 );
				assert.strictEqual( be1.sentErr[0].recipient.name, "U1" );
				assert.strictEqual( be1.sentErr[1].recipient.name, "U3" );
				assert.strictEqual( be2.sentErr.length, 2 );
				assert.strictEqual( be2.sentErr[0].recipient.name, "U2" );
				assert.strictEqual( be2.sentErr[1].recipient.name, "U4" );
				assert.strictEqual( be1.sentAck.length, 2 );
				assert.strictEqual( be1.sentAck[0].recipient.name, "U1" );
				assert.strictEqual( be1.sentAck[1].recipient.name, "U3" );
				assert.strictEqual( be2.sentAck.length, 1 );
				assert.strictEqual( be2.sentAck[0].recipient.name, "U2" );
				done();
			} catch( e ) {
				done( e );
			}
		} );

	} );

	it( "should inform all recipients of error message about recovery", ( done ) => {

		let be1 = new Backend();
		let be2 = new Backend();

		let e = new Escalation(
			{ 'be1': be1, 'be2': be2 },
			Hormone( 'test' ),
			[ {
				delay: 0,
				recipients: [ {
					backend: 'be1',
					name: "U1"
				}, {
					backend: 'be2',
					name: "U2"
				} ]
			}, {
				delay: 0.01,
				recipients: [ {
					backend: 'be1',
					name: "U3"
				}, {
					backend: 'be2',
					name: "U4"
				} ]
			}, {
				delay: 0.01,
				recipients: [ {
					backend: 'be1',
					name: "U5"
				}, {
					backend: 'be2',
					name: "U6"
				} ]
			} ]
		);

		be2.on( 'sentErr', ( recipient, name, hormone ) => {
			if( recipient.name == "U4" ) {
				setImmediate( () => e.deescalate() );
			}
		} );

		e.on( 'deescalated', () => {
			try {
				assert.strictEqual( be1.sentErr.length, 2 );
				assert.strictEqual( be1.sentErr[0].recipient.name, "U1" );
				assert.strictEqual( be1.sentErr[1].recipient.name, "U3" );
				assert.strictEqual( be2.sentErr.length, 2 );
				assert.strictEqual( be2.sentErr[0].recipient.name, "U2" );
				assert.strictEqual( be2.sentErr[1].recipient.name, "U4" );
				assert.strictEqual( be1.sentRec.length, 2 );
				assert.strictEqual( be1.sentRec[0].recipient.name, "U1" );
				assert.strictEqual( be1.sentRec[1].recipient.name, "U3" );
				assert.strictEqual( be2.sentRec.length, 2 );
				assert.strictEqual( be2.sentRec[0].recipient.name, "U2" );
				assert.strictEqual( be2.sentRec[1].recipient.name, "U4" );
				done();
			} catch( e ) {
				done( e );
			}
		} );

	} );

} );
