<?php

namespace Tests\Feature;

use App\Models\Stasiun;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class StaffAuthSecurityTest extends TestCase
{
    use DatabaseTransactions;

    public function test_unregistered_staff_prefix_email_cannot_auto_register_or_login(): void
    {
        $response = $this->postJson('/api/staff/auth/login', [
            'email'    => 'hacker.admin@kci.id',
            'password' => 'lofound2026',
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseMissing('users', ['email' => 'hacker.admin@kci.id']);
    }

    public function test_staff_login_rejects_legacy_hardcoded_passwords_when_real_password_differs(): void
    {
        $stasiun = Stasiun::first() ?? Stasiun::create(['kode' => 'JAKK', 'nama' => 'Jakarta Kota', 'lin' => 'Lin Bogor']);

        User::create([
            'name'       => 'Strict Staff',
            'email'      => 'strict.cs@kci.id',
            'password'   => Hash::make('SecretStaff#99'),
            'role'       => 'cs',
            'stasiun_id' => $stasiun->id,
            'active'     => true,
        ]);

        $this->postJson('/api/staff/auth/login', [
            'email'    => 'strict.cs@kci.id',
            'password' => 'lofound2026',
        ])->assertStatus(422);

        $this->postJson('/api/staff/auth/login', [
            'email'    => 'strict.cs@kci.id',
            'password' => 'password',
        ])->assertStatus(422);

        $ok = $this->postJson('/api/staff/auth/login', [
            'email'    => 'strict.cs@kci.id',
            'password' => 'SecretStaff#99',
        ]);

        $ok->assertStatus(200)->assertJsonStructure(['token', 'user' => ['id', 'email', 'role']]);
    }

    public function test_inactive_staff_and_passenger_accounts_are_rejected(): void
    {
        $stasiun = Stasiun::first() ?? Stasiun::create(['kode' => 'JAKK', 'nama' => 'Jakarta Kota', 'lin' => 'Lin Bogor']);

        User::create([
            'name'       => 'Disabled Staff',
            'email'      => 'disabled.cs@kci.id',
            'password'   => Hash::make('SecretStaff#99'),
            'role'       => 'cs',
            'stasiun_id' => $stasiun->id,
            'active'     => false,
        ]);

        User::create([
            'name'     => 'Passenger Only',
            'email'    => 'penumpang.only@example.com',
            'password' => Hash::make('SecretPass#99'),
            'role'     => 'penumpang',
            'active'   => true,
        ]);

        $this->postJson('/api/staff/auth/login', [
            'email'    => 'disabled.cs@kci.id',
            'password' => 'SecretStaff#99',
        ])->assertStatus(403);

        $this->postJson('/api/staff/auth/login', [
            'email'    => 'penumpang.only@example.com',
            'password' => 'SecretPass#99',
        ])->assertStatus(403);
    }

    public function test_unauthenticated_upload_is_rejected(): void
    {
        $this->postJson('/api/upload', [])->assertStatus(401);
    }

    public function test_tab_token_is_revoked_on_logout_and_rejects_inactive_user(): void
    {
        $stasiun = Stasiun::first() ?? Stasiun::create(['kode' => 'JAKK', 'nama' => 'Jakarta Kota', 'lin' => 'Lin Bogor']);

        $staff = User::create([
            'name'       => 'Token Staff',
            'email'      => 'token.cs@kci.id',
            'password'   => Hash::make('SecretStaff#99'),
            'role'       => 'cs',
            'stasiun_id' => $stasiun->id,
            'active'     => true,
        ]);

        $login = $this->postJson('/api/staff/auth/login', [
            'email'    => 'token.cs@kci.id',
            'password' => 'SecretStaff#99',
        ])->assertStatus(200);

        $token = $login->json('token');
        $this->assertNotEmpty($token);

        // Valid token works
        $this->withHeader('X-Tab-Token', $token)
            ->getJson('/api/staff/auth/user')
            ->assertStatus(200)
            ->assertJsonPath('user.email', 'token.cs@kci.id');

        // Logout revokes token
        $this->withHeader('X-Tab-Token', $token)
            ->postJson('/api/staff/auth/logout')
            ->assertStatus(200);

        $this->withHeader('X-Tab-Token', $token)
            ->getJson('/api/staff/auth/user')
            ->assertStatus(200)
            ->assertJsonPath('user', null);
    }
}
