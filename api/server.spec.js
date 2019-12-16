const request = require('supertest');
const server = require('./server');

describe('server', () => {
    describe('[GET] / endpoint', () => {
        it('the db env is using testing', () => {
            expect(process.env.NODE_ENV).toBe('testing')
        });
        it('should return 200 OK', async () => {
            const response = await request(server).get('/');
            expect(response.status).toBe(200);
        });
        it('returns the right response body', async () => {
            const response = await request(server).get('/');
            expect(response.body).toEqual({up: `workout or stay-out!!!`});
        });
    });
});