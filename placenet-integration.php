<?php
/**
 * Shift Integration for Placenet
 *
 * This file can be placed in your Placenet /app directory
 * Usage: require_once 'ShiftIntegration.php';
 */

namespace App\Integration;

use App\Token;
use Exception;

class ShiftIntegration
{
    private $baseUrl;
    private $timeout = 30;

    /**
     * Constructor
     *
     * @param string $baseUrl Base URL of Shift application
     */
    public function __construct($baseUrl = null)
    {
        $this->baseUrl = $baseUrl ?? env('SHIFT_BASE_URL', 'http://localhost:5173');
    }

    /**
     * Clock in/out/pause
     *
     * @param Token $token Placenet token
     * @param string $eventType 'in', 'out', 'pause_start', 'pause_end'
     * @return array Response from Shift
     */
    public function clock(Token $token, $eventType)
    {
        if (!in_array($eventType, ['in', 'out', 'pause_start', 'pause_end'])) {
            throw new Exception("Invalid event type: $eventType");
        }

        return $this->request('POST', '/api/time/clock', [
            'event_type' => $eventType
        ], $token);
    }

    /**
     * Clock in
     */
    public function clockIn(Token $token)
    {
        return $this->clock($token, 'in');
    }

    /**
     * Clock out
     */
    public function clockOut(Token $token)
    {
        return $this->clock($token, 'out');
    }

    /**
     * Start pause
     */
    public function startPause(Token $token)
    {
        return $this->clock($token, 'pause_start');
    }

    /**
     * End pause
     */
    public function endPause(Token $token)
    {
        return $this->clock($token, 'pause_end');
    }

    /**
     * Get current clock status
     *
     * @param Token $token Placenet token
     * @return array Status information
     */
    public function getStatus(Token $token)
    {
        return $this->request('GET', '/api/time/status', null, $token);
    }

    /**
     * Get time events for user
     *
     * @param Token $token Placenet token
     * @param string|null $from ISO-8601 date
     * @param string|null $to ISO-8601 date
     * @return array Events
     */
    public function getEvents(Token $token, $from = null, $to = null)
    {
        $query = [];
        if ($from) $query['from'] = $from;
        if ($to) $query['to'] = $to;

        $path = '/api/time/events';
        if ($query) $path .= '?' . http_build_query($query);

        return $this->request('GET', $path, null, $token);
    }

    /**
     * Get all events (admin only)
     *
     * @param Token $token Placenet admin token
     * @param string|null $from ISO-8601 date
     * @param string|null $to ISO-8601 date
     * @param int|null $userId Filter by user ID
     * @return array All events
     */
    public function adminGetEvents(Token $token, $from = null, $to = null, $userId = null)
    {
        $query = [];
        if ($from) $query['from'] = $from;
        if ($to) $query['to'] = $to;
        if ($userId) $query['user_id'] = $userId;

        $path = '/api/admin/events';
        if ($query) $path .= '?' . http_build_query($query);

        return $this->request('GET', $path, null, $token);
    }

    /**
     * Export data (admin only)
     *
     * @param Token $token Placenet admin token
     * @param string $format 'csv' or 'json'
     * @param string|null $from ISO-8601 date
     * @param string|null $to ISO-8601 date
     * @param int|null $userId Filter by user ID
     * @return string Raw export data
     */
    public function export(Token $token, $format = 'csv', $from = null, $to = null, $userId = null)
    {
        $query = ['format' => $format];
        if ($from) $query['from'] = $from;
        if ($to) $query['to'] = $to;
        if ($userId) $query['user_id'] = $userId;

        $path = '/api/admin/export?' . http_build_query($query);

        // Return raw response for exports
        return $this->requestRaw('GET', $path, null, $token);
    }

    /**
     * Get all users (admin only)
     *
     * @param Token $token Placenet admin token
     * @return array Users list
     */
    public function adminGetUsers(Token $token)
    {
        return $this->request('GET', '/api/admin/users', null, $token);
    }

    /**
     * Create Shift-compatible token from Placenet data
     *
     * @param string $avatarId
     * @param string $avatarName
     * @param string $avatarEmail
     * @param string $domainId
     * @param string $domainName
     * @param array $tags
     * @param bool $isAdmin
     * @return Token
     */
    public static function createToken($avatarId, $avatarName, $avatarEmail, $domainId, $domainName, $tags = [], $isAdmin = false)
    {
        $payload = [
            'avatar_id' => $avatarId,
            'avatar_name' => $avatarName,
            'avatar_email' => $avatarEmail,
            'domain_id' => $domainId,
            'domain_name' => $domainName,
            'domain_tags' => $tags
        ];

        if ($isAdmin && !in_array('admin', $tags)) {
            $payload['domain_tags'][] = 'admin';
        }

        return (new Token(env('JWT_KID', 'ACC01')))
            ->payload($payload)
            ->expireHours(8);
    }

    /**
     * Make HTTP request to Shift API
     *
     * @param string $method HTTP method
     * @param string $path API path
     * @param array|null $data Request data
     * @param Token|null $token Authentication token
     * @return array Decoded JSON response
     */
    private function request($method, $path, $data = null, Token $token = null)
    {
        $response = $this->requestRaw($method, $path, $data, $token);
        $decoded = json_decode($response, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Invalid JSON response: $response");
        }

        return $decoded;
    }

    /**
     * Make raw HTTP request to Shift API
     *
     * @param string $method HTTP method
     * @param string $path API path
     * @param array|null $data Request data
     * @param Token|null $token Authentication token
     * @return string Raw response
     */
    private function requestRaw($method, $path, $data = null, Token $token = null)
    {
        $url = $this->baseUrl . $path;

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
        ];

        if ($token) {
            $headers[] = 'Authorization: Bearer ' . (string)$token;
        }

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        } elseif ($method === 'PUT') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception("CURL Error: $error");
        }

        if ($httpCode >= 400) {
            throw new Exception("HTTP Error $httpCode: $response");
        }

        return $response;
    }

    /**
     * Set request timeout
     *
     * @param int $seconds Timeout in seconds
     * @return self
     */
    public function setTimeout($seconds)
    {
        $this->timeout = $seconds;
        return $this;
    }
}

// Example usage (comment out or remove in production)
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['PHP_SELF'])) {
    echo "=== Shift Integration Example ===\n\n";

    // Create test token
    $token = ShiftIntegration::createToken(
        'TESTU1',
        'Juan Pérez',
        'juan@example.com',
        'DXX1',
        'Empresa Test S.L.',
        [],
        false // not admin
    );

    echo "Token created: " . substr((string)$token, 0, 50) . "...\n\n";

    // Initialize integration
    $shift = new ShiftIntegration('http://localhost:5173');

    try {
        // Clock in
        echo "Clocking in...\n";
        $result = $shift->clockIn($token);
        echo "Success: " . json_encode($result) . "\n\n";

        // Get status
        echo "Getting status...\n";
        $status = $shift->getStatus($token);
        echo "Status: " . $status['status'] . "\n\n";

        // Get events
        echo "Getting events...\n";
        $events = $shift->getEvents($token);
        echo "Events count: " . $events['count'] . "\n\n";

    } catch (Exception $e) {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
