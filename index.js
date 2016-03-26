"use strict";

const Notify = require( './lib/notify.js' );

module.exports = function( options ) {
	return new Notify( options );
};
