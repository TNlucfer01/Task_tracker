require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in Back/.env or the environment.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
