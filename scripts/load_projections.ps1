$projections = 'projection_account_info'
Foreach ($projection in $projections)
{
	$fileName = '@C:\my_workspaces\forecaster\app\projections\' + $projection + '.js'
	$streamId = 'http://127.0.0.1:2113/projections/continuous?emit=yes&checkpoints=yes&enabled=yes&name=' + $projection
	$args = @('-i', '-X', 'POST', '-d', $fileName, $streamId, '-H', 'Content-Type:application/json', '-u', 'admin:changeit')
	& 'C:\my_workspaces\curl.exe' $args
}