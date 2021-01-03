const chai = require('chai');
const hello = require('../src');

const { expect } = chai;

describe('Basic test', () => {
  it('should pass', () => {
    expect(hello()).to.equal('world');
  });
});
